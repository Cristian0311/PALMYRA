create or replace function public.palmyra_process_bank_transaction(
 p_id uuid,p_company_id uuid,p_bank_account_id uuid,p_type text,p_amount numeric,p_date timestamptz,p_reference text,p_description text,p_transaction_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); v_delta numeric; v_account public.bank_accounts%rowtype;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) or not private.has_permission(p_company_id,'settings.manage') then raise exception 'permission_denied'; end if;
 select * into v_account from public.bank_accounts where id=p_bank_account_id and company_id=p_company_id and active for update;
 if not found then raise exception 'bank_account_not_found'; end if;
 if exists(select 1 from public.bank_transactions where id=p_id and company_id=p_company_id) then return jsonb_build_object('success',true,'already_existed',true,'id',p_id,'balance',v_account.balance); end if;
 v_delta:=case when lower(coalesce(p_type,'')) in ('deposit','payment_received') then p_amount else -p_amount end;
 if v_account.balance+v_delta<0 then raise exception 'insufficient_bank_balance'; end if;
 insert into public.bank_transactions(id,company_id,bank_account_id,transaction_type,amount,currency_code,reference,note,created_by,created_at)
 values(p_id,p_company_id,p_bank_account_id,p_type,abs(p_amount),v_account.currency_code,p_reference,p_description,v_auth,coalesce(p_date,timezone('utc',now())));
 update public.bank_accounts set balance=v_account.balance+v_delta,updated_at=timezone('utc',now()) where id=p_bank_account_id and company_id=p_company_id;
 return jsonb_build_object('success',true,'already_existed',false,'id',p_id,'balance',v_account.balance+v_delta,'transaction_id',p_transaction_id);
end;
$$;
create or replace function public.palmyra_delete_bank_transaction(p_transaction_id uuid,p_company_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); t public.bank_transactions%rowtype; v_delta numeric;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) or not private.has_permission(p_company_id,'settings.manage') then raise exception 'permission_denied'; end if;
 select * into t from public.bank_transactions where id=p_transaction_id and company_id=p_company_id for update;
 if not found then return jsonb_build_object('success',true,'already_deleted',true); end if;
 v_delta:=case when lower(coalesce(t.transaction_type,'')) in ('deposit','payment_received') then -t.amount else t.amount end;
 update public.bank_accounts set balance=greatest(0,balance+v_delta),updated_at=timezone('utc',now()) where id=t.bank_account_id and company_id=p_company_id;
 delete from public.bank_transactions where id=t.id and company_id=p_company_id;
 return jsonb_build_object('success',true,'already_deleted',false,'id',t.id);
end;
$$;
create or replace function public.palmyra_bank_internal_transfer(
 p_operation_id uuid,p_company_id uuid,p_from_bank_account_id uuid,p_to_bank_account_id uuid,p_amount numeric,p_target_amount numeric,p_date timestamptz,p_reason text
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); a public.bank_accounts%rowtype; b public.bank_accounts%rowtype; out_id uuid; in_id uuid; target numeric;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) or not private.has_permission(p_company_id,'settings.manage') then raise exception 'permission_denied'; end if;
 if p_from_bank_account_id=p_to_bank_account_id or p_amount<=0 then raise exception 'invalid_bank_transfer'; end if;
 perform pg_advisory_xact_lock(hashtext(p_company_id::text||':bank-transfer'));
 select * into a from public.bank_accounts where id=p_from_bank_account_id and company_id=p_company_id and active for update;
 select * into b from public.bank_accounts where id=p_to_bank_account_id and company_id=p_company_id and active for update;
 if a.id is null or b.id is null then raise exception 'bank_account_not_found'; end if;
 if a.balance<p_amount then raise exception 'insufficient_bank_balance'; end if;
 target:=greatest(0,coalesce(p_target_amount,p_amount));
 if exists(select 1 from public.bank_transactions bt where bt.reference=p_operation_id::text and bt.company_id=p_company_id) then return jsonb_build_object('success',true,'already_existed',true,'operation_id',p_operation_id); end if;
 out_id:=gen_random_uuid();in_id:=gen_random_uuid();
 insert into public.bank_transactions(id,company_id,bank_account_id,transaction_type,amount,currency_code,reference,note,created_by,created_at)
 values(out_id,p_company_id,a.id,'withdrawal',p_amount,a.currency_code,p_operation_id::text,coalesce(p_reason,'Transferencia interna'),v_auth,coalesce(p_date,timezone('utc',now()))),
       (in_id,p_company_id,b.id,'deposit',target,b.currency_code,p_operation_id::text,coalesce(p_reason,'Transferencia interna'),v_auth,coalesce(p_date,timezone('utc',now())));
 update public.bank_accounts set balance=balance-p_amount,updated_at=timezone('utc',now()) where id=a.id and company_id=p_company_id;
 update public.bank_accounts set balance=balance+target,updated_at=timezone('utc',now()) where id=b.id and company_id=p_company_id;
 return jsonb_build_object('success',true,'already_existed',false,'operation_id',p_operation_id,'from_transaction_id',out_id,'to_transaction_id',in_id);
end;
$$;
create or replace function public.palmyra_delete_bank_internal_transfer(p_operation_id uuid,p_company_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); t record;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) or not private.has_permission(p_company_id,'settings.manage') then raise exception 'permission_denied'; end if;
 for t in select * from public.bank_transactions where company_id=p_company_id and reference=p_operation_id::text loop
   if lower(t.transaction_type)='deposit' then
     update public.bank_accounts set balance=greatest(0,balance-t.amount),updated_at=timezone('utc',now()) where id=t.bank_account_id and company_id=p_company_id;
   else
     update public.bank_accounts set balance=balance+t.amount,updated_at=timezone('utc',now()) where id=t.bank_account_id and company_id=p_company_id;
   end if;
 end loop;
 delete from public.bank_transactions where company_id=p_company_id and reference=p_operation_id::text;
 return jsonb_build_object('success',true,'operation_id',p_operation_id);
end;
$$;
grant execute on function public.palmyra_process_bank_transaction(uuid,uuid,uuid,text,numeric,timestamptz,text,text,uuid) to authenticated;
grant execute on function public.palmyra_delete_bank_transaction(uuid,uuid) to authenticated;
grant execute on function public.palmyra_bank_internal_transfer(uuid,uuid,uuid,uuid,numeric,numeric,timestamptz,text) to authenticated;
grant execute on function public.palmyra_delete_bank_internal_transfer(uuid,uuid) to authenticated;
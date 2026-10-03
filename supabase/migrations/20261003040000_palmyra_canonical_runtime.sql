create or replace function private.normalize_permission_key(p_key text)
returns text language sql immutable as $$
  select case lower(trim(coalesce(p_key,'')))
    when 'pos.use' then 'pos.access'
    when 'pos_access' then 'pos.access'
    when 'reports_access' then 'reports.view'
    when 'inventory.adjust' then 'inventory.manage'
    when 'inventory.transfer' then 'inventory.manage'
    when 'cash.open' then 'pos.access'
    when 'cash.close' then 'settings.manage'
    when 'cash.manage' then 'settings.manage'
    when 'sales.refund' then 'settings.manage'
    when 'quotes.manage' then 'quotes.manage'
    when 'purchases.manage' then 'suppliers.manage'
    when 'payroll.manage' then 'settings.manage'
    when 'audit.view' then 'reports.view'
    else lower(trim(coalesce(p_key,'')))
  end;
$$;

alter table public.sales add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.palmyra_record_sale(
  p_sale_id uuid,p_company_id uuid,p_warehouse_id uuid,p_cash_session_id uuid,p_user_id uuid,
  p_total numeric,p_currency_code text,p_notes text,p_customer_id uuid,p_items jsonb,p_payments jsonb
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_auth uuid:=auth.uid(); v_existing public.sales%rowtype; v_employee uuid; v_currency text;
  it jsonb; pid uuid; vid uuid; qty numeric; price numeric; disc numeric; tax numeric; total numeric; stock numeric; method public.payment_method;
begin
  if v_auth is null then raise exception 'authentication_required'; end if;
  if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
  if not private.has_permission(p_company_id,'pos.access') then raise exception 'permission_denied'; end if;
  if not exists(select 1 from public.warehouses where id=p_warehouse_id and company_id=p_company_id and active) then raise exception 'invalid_warehouse'; end if;
  if p_cash_session_id is not null and not exists(
    select 1 from public.cash_sessions cs join public.cash_registers cr on cr.id=cs.cash_register_id
    where cs.id=p_cash_session_id and cs.company_id=p_company_id and cr.warehouse_id=p_warehouse_id and cs.status='open'
  ) then raise exception 'invalid_cash_session'; end if;
  select e.id into v_employee from public.employees e where e.company_id=p_company_id and e.active and (e.id=p_user_id or e.user_id=p_user_id) order by (e.id=p_user_id) desc limit 1;
  select default_currency_code into v_currency from public.companies where id=p_company_id;
  select * into v_existing from public.sales where id=p_sale_id and company_id=p_company_id limit 1;
  if found then return jsonb_build_object('success',true,'id',v_existing.id,'already_existed',true); end if;
  insert into public.sales(id,company_id,warehouse_id,cash_session_id,employee_id,seller_user_id,status,total,currency_code,client_name,notes,source_operation_id,customer_id,metadata)
  values(p_sale_id,p_company_id,p_warehouse_id,p_cash_session_id,v_employee,v_auth,'completed',coalesce(p_total,0),coalesce(nullif(p_currency_code,''),v_currency),null,coalesce(p_notes,''),p_sale_id,p_customer_id,'{}'::jsonb);
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    pid:=nullif(it->>'product_id','')::uuid;
    qty:=greatest(coalesce((it->>'quantity')::numeric,0),0);
    price:=coalesce((it->>'price')::numeric,0);
    disc:=coalesce((it->>'discount')::numeric,0);
    tax:=coalesce((it->>'tax')::numeric,0);
    total:=coalesce((it->>'total')::numeric,price*qty);
    if pid is null or qty<=0 then raise exception 'invalid_sale_item'; end if;
    if not exists(select 1 from public.products where id=pid and company_id=p_company_id and status not in ('archived')) then raise exception 'invalid_product'; end if;
    vid:=null;
    if nullif(trim(coalesce(it->>'variant_id',it->>'variantId','')),'') is not null then
      vid:=coalesce(it->>'variant_id',it->>'variantId')::uuid;
    elsif nullif(trim(coalesce(it->>'variant_label',it->>'variantLabel','')),'') is not null then
      select id into vid from public.product_variants where company_id=p_company_id and product_id=pid and name=coalesce(it->>'variant_label',it->>'variantLabel') and active limit 1;
    end if;
    insert into public.sale_items(id,sale_id,product_id,variant_id,quantity,unit_price,discount,tax,line_total,serial_number)
    values(gen_random_uuid(),p_sale_id,pid,vid,qty,price,disc,tax,total,nullif(coalesce(it->>'serial_number',it->>'serialNumber'),''));
    if coalesce((select track_stock from public.products where id=pid),true) then
      if vid is null then
        select quantity into stock from public.stock_balances where company_id=p_company_id and warehouse_id=p_warehouse_id and product_id=pid and variant_id is null for update;
        if not found or stock<qty then raise exception 'insufficient_stock'; end if;
        update public.stock_balances set quantity=quantity-qty,updated_at=timezone('utc',now()) where warehouse_id=p_warehouse_id and product_id=pid;
      else
        select quantity into stock from public.variant_stock_balances where company_id=p_company_id and warehouse_id=p_warehouse_id and product_id=pid and variant_id=vid for update;
        if not found or stock<qty then raise exception 'insufficient_stock'; end if;
        update public.variant_stock_balances set quantity=quantity-qty,updated_at=timezone('utc',now()) where company_id=p_company_id and warehouse_id=p_warehouse_id and product_id=pid and variant_id=vid;
      end if;
      insert into public.stock_movements(id,company_id,warehouse_id,product_id,movement_type,quantity,reference_type,reference_id,created_by,occurred_at,variant_id)
      values(gen_random_uuid(),p_company_id,p_warehouse_id,pid,'sale',-qty,'sale',p_sale_id,v_auth,timezone('utc',now()),vid);
    end if;
  end loop;
  for it in select * from jsonb_array_elements(coalesce(p_payments,'[]'::jsonb)) loop
    method:=case coalesce(it->>'method','cash')
      when 'transfer' then 'bank_transfer'::public.payment_method
      when 'bank_transfer' then 'bank_transfer'::public.payment_method
      when 'card' then 'card'::public.payment_method
      when 'other' then 'other'::public.payment_method
      else 'cash'::public.payment_method end;
    insert into public.payments(id,company_id,sale_id,method,currency_code,amount,exchange_rate,reference,created_by)
    values(gen_random_uuid(),p_company_id,p_sale_id,method,coalesce(it->>'currency_code',it->>'currencyCode',v_currency),coalesce((it->>'amount')::numeric,0),coalesce((it->>'exchange_rate')::numeric,(it->>'exchangeRate')::numeric,1),nullif(it->>'reference',''),v_auth);
  end loop;
  return jsonb_build_object('success',true,'id',p_sale_id,'already_existed',false);
exception when unique_violation then
  select * into v_existing from public.sales where id=p_sale_id and company_id=p_company_id limit 1;
  if found then return jsonb_build_object('success',true,'id',v_existing.id,'already_existed',true); end if;
  raise;
end;
$$;

create or replace function public.palmyra_void_sale(p_sale_id uuid,p_company_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); v_sale public.sales%rowtype; it record;
begin
  if v_auth is null then raise exception 'authentication_required'; end if;
  if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
  if not private.has_permission(p_company_id,'sales.refund') then raise exception 'permission_denied'; end if;
  select * into v_sale from public.sales where id=p_sale_id and company_id=p_company_id for update;
  if not found then raise exception 'sale_not_found'; end if;
  if v_sale.status in ('voided','refunded') then return jsonb_build_object('success',true,'already_refunded',true); end if;
  for it in select product_id,variant_id,quantity from public.sale_items where sale_id=p_sale_id loop
    if it.variant_id is null then
      insert into public.stock_balances(company_id,warehouse_id,product_id,quantity,updated_at,variant_id)
      values(p_company_id,v_sale.warehouse_id,it.product_id,it.quantity,timezone('utc',now()),null)
      on conflict(warehouse_id,product_id) do update set quantity=public.stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
    else
      insert into public.variant_stock_balances(company_id,warehouse_id,product_id,variant_id,quantity,updated_at)
      values(p_company_id,v_sale.warehouse_id,it.product_id,it.variant_id,it.quantity,timezone('utc',now()))
      on conflict(company_id,warehouse_id,variant_id) do update set quantity=public.variant_stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
    end if;
    insert into public.stock_movements(id,company_id,warehouse_id,product_id,movement_type,quantity,reference_type,reference_id,created_by,occurred_at,variant_id,note)
    values(gen_random_uuid(),p_company_id,v_sale.warehouse_id,it.product_id,'sale_refund',it.quantity,'sale_void',p_sale_id,v_auth,timezone('utc',now()),it.variant_id,coalesce(p_reason,'Anulación'));
  end loop;
  update public.sales set status='voided',notes=concat_ws(E'\n',nullif(notes,''),coalesce(p_reason,'Anulación')) where id=p_sale_id and company_id=p_company_id;
  return jsonb_build_object('success',true,'already_refunded',false);
end;
$$;

create or replace function public.palmyra_transfer_inventory(
  p_operation_id uuid,p_company_id uuid,p_from_warehouse_id uuid,p_to_warehouse_id uuid,p_product_id uuid,p_variant_id uuid,p_quantity numeric,p_notes text
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); source_qty numeric;
begin
  if v_auth is null then raise exception 'authentication_required'; end if;
  if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
  if not private.has_permission(p_company_id,'inventory.transfer') then raise exception 'permission_denied'; end if;
  if p_from_warehouse_id=p_to_warehouse_id or p_quantity<=0 then raise exception 'invalid_transfer'; end if;
  if not exists(select 1 from public.warehouses where id=p_from_warehouse_id and company_id=p_company_id and active) or not exists(select 1 from public.warehouses where id=p_to_warehouse_id and company_id=p_company_id and active) then raise exception 'invalid_warehouse'; end if;
  if not exists(select 1 from public.products where id=p_product_id and company_id=p_company_id and status not in ('archived')) then raise exception 'invalid_product'; end if;
  if p_variant_id is null then
    select quantity into source_qty from public.stock_balances where warehouse_id=p_from_warehouse_id and product_id=p_product_id and variant_id is null for update;
    if not found or source_qty<p_quantity then raise exception 'insufficient_stock'; end if;
    update public.stock_balances set quantity=quantity-p_quantity,updated_at=timezone('utc',now()) where warehouse_id=p_from_warehouse_id and product_id=p_product_id;
    insert into public.stock_balances(company_id,warehouse_id,product_id,quantity,updated_at,variant_id)
    values(p_company_id,p_to_warehouse_id,p_product_id,p_quantity,timezone('utc',now()),null)
    on conflict(warehouse_id,product_id) do update set quantity=public.stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
  else
    select quantity into source_qty from public.variant_stock_balances where company_id=p_company_id and warehouse_id=p_from_warehouse_id and product_id=p_product_id and variant_id=p_variant_id for update;
    if not found or source_qty<p_quantity then raise exception 'insufficient_stock'; end if;
    update public.variant_stock_balances set quantity=quantity-p_quantity,updated_at=timezone('utc',now()) where company_id=p_company_id and warehouse_id=p_from_warehouse_id and product_id=p_product_id and variant_id=p_variant_id;
    insert into public.variant_stock_balances(company_id,warehouse_id,product_id,variant_id,quantity,updated_at)
    values(p_company_id,p_to_warehouse_id,p_product_id,p_variant_id,p_quantity,timezone('utc',now()))
    on conflict(company_id,warehouse_id,variant_id) do update set quantity=public.variant_stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
  end if;
  insert into public.transfers(id,company_id,origin_warehouse_id,destination_warehouse_id,status,notes,created_by)
  values(p_operation_id,p_company_id,p_from_warehouse_id,p_to_warehouse_id,'posted',p_notes,v_auth)
  on conflict(id) do nothing;
  if not exists(select 1 from public.transfer_items where transfer_id=p_operation_id and product_id=p_product_id and coalesce(variant_id,'00000000-0000-0000-0000-000000000000')=coalesce(p_variant_id,'00000000-0000-0000-0000-000000000000')) then
    insert into public.transfer_items(id,transfer_id,product_id,quantity,variant_id) values(gen_random_uuid(),p_operation_id,p_product_id,p_quantity,p_variant_id);
  end if;
  insert into public.stock_movements(id,company_id,warehouse_id,product_id,movement_type,quantity,reference_type,reference_id,created_by,occurred_at,variant_id,note)
  values
   (gen_random_uuid(),p_company_id,p_from_warehouse_id,p_product_id,'transfer_out',-p_quantity,'transfer',p_operation_id,v_auth,timezone('utc',now()),p_variant_id,p_notes),
   (gen_random_uuid(),p_company_id,p_to_warehouse_id,p_product_id,'transfer_in',p_quantity,'transfer',p_operation_id,v_auth,timezone('utc',now()),p_variant_id,p_notes);
  return jsonb_build_object('success',true,'id',p_operation_id);
exception when unique_violation then
  if exists(select 1 from public.transfers where id=p_operation_id and company_id=p_company_id) then return jsonb_build_object('success',true,'id',p_operation_id,'already_existed',true); end if;
  raise;
end;
$$;

create or replace function public.palmyra_receive_purchase(p_order_id uuid,p_company_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); v_order public.purchase_orders%rowtype; it record;
begin
  if v_auth is null then raise exception 'authentication_required'; end if;
  if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
  if not private.has_permission(p_company_id,'purchases.manage') then raise exception 'permission_denied'; end if;
  select * into v_order from public.purchase_orders where id=p_order_id and company_id=p_company_id for update;
  if not found then raise exception 'purchase_order_not_found'; end if;
  if v_order.status='received' then return jsonb_build_object('success',true,'already_received',true); end if;
  for it in select product_id,quantity from public.purchase_items where purchase_order_id=p_order_id loop
    insert into public.stock_balances(company_id,warehouse_id,product_id,quantity,updated_at,variant_id)
    values(p_company_id,v_order.warehouse_id,it.product_id,it.quantity,timezone('utc',now()),null)
    on conflict(warehouse_id,product_id) do update set quantity=public.stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
    insert into public.stock_movements(id,company_id,warehouse_id,product_id,movement_type,quantity,reference_type,reference_id,created_by,occurred_at,note)
    values(gen_random_uuid(),p_company_id,v_order.warehouse_id,it.product_id,'purchase',it.quantity,'purchase_order',p_order_id,v_auth,timezone('utc',now()),'Recepción de compra');
  end loop;
  update public.purchase_orders set status='received',updated_at=timezone('utc',now()) where id=p_order_id and company_id=p_company_id;
  return jsonb_build_object('success',true,'already_received',false);
end;
$$;

create or replace function public.palmyra_open_cash_session(
  p_session_id uuid,p_company_id uuid,p_warehouse_id uuid,p_user_id uuid,p_opening_amount numeric,p_opened_at timestamptz
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); v_employee uuid; v_register uuid; v_turn bigint; v_row public.cash_sessions%rowtype;
begin
  if v_auth is null then raise exception 'authentication_required'; end if;
  if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
  if not private.has_permission(p_company_id,'cash.open') then raise exception 'permission_denied'; end if;
  if not exists(select 1 from public.warehouses where id=p_warehouse_id and company_id=p_company_id and active) then raise exception 'invalid_warehouse'; end if;
  select e.id into v_employee from public.employees e where e.company_id=p_company_id and e.active and (e.id=p_user_id or e.user_id=p_user_id) order by (e.id=p_user_id) desc limit 1;
  select id into v_register from public.cash_registers where company_id=p_company_id and warehouse_id=p_warehouse_id and active order by id limit 1;
  if v_register is null then
    insert into public.cash_registers(id,company_id,warehouse_id,code,name,active) values(gen_random_uuid(),p_company_id,p_warehouse_id,'CAJA-'||upper(left(p_warehouse_id::text,6)),'Caja principal',true) returning id into v_register;
  end if;
  select * into v_row from public.cash_sessions where id=p_session_id and company_id=p_company_id limit 1;
  if found then
    if v_row.status='open' then return jsonb_build_object('success',true,'already_existed',true,'id',v_row.id,'turn_number',v_row.turn_number,'opened_at',v_row.opened_at,'opening_amount',v_row.opening_amount,'employee_id',v_row.employee_id); end if;
    raise exception 'cash_session_reopen_blocked';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_company_id::text));
  if exists(select 1 from public.cash_sessions where cash_register_id=v_register and status='open') then raise exception 'cash_register_already_open'; end if;
  select coalesce(max(turn_number),0)+1 into v_turn from public.cash_sessions where company_id=p_company_id;
  insert into public.cash_sessions(id,company_id,cash_register_id,employee_id,opened_by,status,opened_at,opening_amount,turn_number)
  values(p_session_id,p_company_id,v_register,v_employee,v_auth,'open',coalesce(p_opened_at,timezone('utc',now())),greatest(coalesce(p_opening_amount,0),0),v_turn)
  returning * into v_row;
  return jsonb_build_object('success',true,'id',v_row.id,'turn_number',v_row.turn_number,'opened_at',v_row.opened_at,'opening_amount',v_row.opening_amount,'employee_id',v_row.employee_id);
end;
$$;

create or replace function public.palmyra_close_cash_session(
 p_session_id uuid,p_company_id uuid,p_closed_at timestamptz,p_physical_cash numeric,p_expected_cash numeric,p_difference numeric,p_notes text
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); v_row public.cash_sessions%rowtype;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
 if not private.has_permission(p_company_id,'cash.close') then raise exception 'permission_denied'; end if;
 select * into v_row from public.cash_sessions where id=p_session_id and company_id=p_company_id for update;
 if not found then raise exception 'cash_session_not_found'; end if;
 if v_row.status='closed' then return jsonb_build_object('success',true,'already_closed',true); end if;
 update public.cash_sessions set status='closed',closed_at=coalesce(p_closed_at,timezone('utc',now())),closed_by=v_auth,physical_cash=p_physical_cash,expected_cash=p_expected_cash,difference=coalesce(p_difference,0) where id=p_session_id and company_id=p_company_id;
 return jsonb_build_object('success',true,'already_closed',false);
end;
$$;

create or replace function public.palmyra_cancel_cash_session(p_session_id uuid,p_company_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); v_row public.cash_sessions%rowtype;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
 if not private.has_permission(p_company_id,'cash.close') then raise exception 'permission_denied'; end if;
 select * into v_row from public.cash_sessions where id=p_session_id and company_id=p_company_id for update;
 if not found then raise exception 'cash_session_not_found'; end if;
 if v_row.status='voided' then return jsonb_build_object('success',true,'already_cancelled',true); end if;
 update public.cash_sessions set status='voided',closed_at=timezone('utc',now()),closed_by=v_auth,difference=0 where id=p_session_id and company_id=p_company_id;
 return jsonb_build_object('success',true,'already_cancelled',false);
end;
$$;

create or replace function public.palmyra_create_return(
 p_return_id uuid,p_company_id uuid,p_sale_id uuid,p_product_id uuid,p_quantity numeric,p_reason text,p_amount numeric,p_type text
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); v_sale public.sales%rowtype;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
 if not private.has_permission(p_company_id,'sales.refund') then raise exception 'permission_denied'; end if;
 select * into v_sale from public.sales where id=p_sale_id and company_id=p_company_id limit 1;
 if not found then raise exception 'sale_not_found'; end if;
 insert into public.sales_returns(id,company_id,sale_id,status,reason,total,created_by,return_type,refund_status,refund_amount)
 values(p_return_id,p_company_id,p_sale_id,'pending',coalesce(p_reason,''),coalesce(p_amount,0),v_auth,coalesce(p_type,'refund'),'pending',coalesce(p_amount,0))
 on conflict(id) do nothing;
 insert into public.sales_return_items(id,return_id,sale_item_id,product_id,quantity,unit_price,line_total,variant_id)
 select gen_random_uuid(),p_return_id,si.id,si.product_id,least(p_quantity,si.quantity),si.unit_price,least(p_quantity,si.quantity)*si.unit_price,si.variant_id
 from public.sale_items si where si.sale_id=p_sale_id and si.product_id=p_product_id order by si.id limit 1
 on conflict do nothing;
 return jsonb_build_object('success',true,'id',p_return_id);
end;
$$;

create or replace function public.palmyra_complete_return(p_return_id uuid,p_company_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); r public.sales_returns%rowtype; it record; sale_warehouse uuid;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
 if not private.has_permission(p_company_id,'sales.refund') then raise exception 'permission_denied'; end if;
 select * into r from public.sales_returns where id=p_return_id and company_id=p_company_id for update;
 if not found then raise exception 'return_not_found'; end if;
 if r.status='completed' then return jsonb_build_object('success',true,'already_completed',true); end if;
 select warehouse_id into sale_warehouse from public.sales where id=r.sale_id and company_id=p_company_id;
 for it in select product_id,variant_id,quantity from public.sales_return_items where return_id=p_return_id loop
   if it.variant_id is null then
     insert into public.stock_balances(company_id,warehouse_id,product_id,quantity,updated_at,variant_id)
     values(p_company_id,sale_warehouse,it.product_id,it.quantity,timezone('utc',now()),null)
     on conflict(warehouse_id,product_id) do update set quantity=public.stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
   else
     insert into public.variant_stock_balances(company_id,warehouse_id,product_id,variant_id,quantity,updated_at)
     values(p_company_id,sale_warehouse,it.product_id,it.variant_id,it.quantity,timezone('utc',now()))
     on conflict(company_id,warehouse_id,variant_id) do update set quantity=public.variant_stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
   end if;
   insert into public.stock_movements(id,company_id,warehouse_id,product_id,movement_type,quantity,reference_type,reference_id,created_by,occurred_at,variant_id,note)
   values(gen_random_uuid(),p_company_id,sale_warehouse,it.product_id,'sale_refund',it.quantity,'return',p_return_id,v_auth,timezone('utc',now()),it.variant_id,'Devolución');
 end loop;
 update public.sales_returns set status='completed',refund_status='completed',updated_at=timezone('utc',now()) where id=p_return_id and company_id=p_company_id;
 return jsonb_build_object('success',true,'already_completed',false);
end;
$$;

create or replace function public.palmyra_start_audit(p_audit_id uuid,p_company_id uuid,p_warehouse_id uuid,p_notes text,p_blind boolean)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid();
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) or not private.has_permission(p_company_id,'inventory.manage') then raise exception 'permission_denied'; end if;
 insert into public.inventory_audits(id,company_id,warehouse_id,status,blind_count,notes,created_by,submitted_at)
 values(p_audit_id,p_company_id,p_warehouse_id,'counting',coalesce(p_blind,false),p_notes,v_auth,null)
 on conflict(id) do nothing;
 return jsonb_build_object('success',true,'id',p_audit_id);
end;
$$;

create or replace function public.palmyra_save_audit_count(p_audit_id uuid,p_company_id uuid,p_items jsonb,p_notes text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); it jsonb;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) or not private.has_permission(p_company_id,'inventory.manage') then raise exception 'permission_denied'; end if;
 if not exists(select 1 from public.inventory_audits where id=p_audit_id and company_id=p_company_id) then raise exception 'audit_not_found'; end if;
 delete from public.inventory_audit_items where audit_id=p_audit_id;
 for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
   insert into public.inventory_audit_items(id,audit_id,product_id,expected_quantity,counted_quantity,difference,notes)
   values(gen_random_uuid(),p_audit_id,nullif(it->>'product_id','')::uuid,(it->>'expected')::numeric,(it->>'counted')::numeric,(it->>'difference')::numeric,null);
 end loop;
 update public.inventory_audits set status='submitted',submitted_at=timezone('utc',now()),notes=coalesce(nullif(p_notes,''),notes),updated_at=timezone('utc',now()) where id=p_audit_id and company_id=p_company_id;
 return jsonb_build_object('success',true,'id',p_audit_id);
end;
$$;

create or replace function public.palmyra_request_audit_recount(p_audit_id uuid,p_company_id uuid,p_notes text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid();
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) or not private.has_permission(p_company_id,'inventory.manage') then raise exception 'permission_denied'; end if;
 update public.inventory_audits set status='recount_requested',notes=concat_ws(' | ',notes,nullif(p_notes,'')),reviewed_by=v_auth,reviewed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=p_audit_id and company_id=p_company_id;
 return jsonb_build_object('success',true,'recount_count',1);
end;
$$;

create or replace function public.palmyra_approve_audit(p_audit_id uuid,p_company_id uuid,p_notes text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid();
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) or not private.has_permission(p_company_id,'inventory.manage') then raise exception 'permission_denied'; end if;
 update public.inventory_audits set status='approved',reviewed_by=v_auth,reviewed_at=timezone('utc',now()),notes=concat_ws(' | ',notes,nullif(p_notes,'')),updated_at=timezone('utc',now()) where id=p_audit_id and company_id=p_company_id;
 return jsonb_build_object('success',true,'id',p_audit_id);
end;
$$;

create or replace function public.palmyra_complete_audit(p_audit_id uuid,p_company_id uuid,p_warehouse_id uuid,p_items jsonb,p_notes text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); it jsonb; pid uuid; qty numeric; vid uuid;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) or not private.has_permission(p_company_id,'inventory.manage') then raise exception 'permission_denied'; end if;
 for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
   pid:=nullif(it->>'product_id','')::uuid; qty:=greatest(coalesce((it->>'counted')::numeric,0),0); vid:=nullif(it->>'variant_id','')::uuid;
   if vid is null then
     insert into public.stock_balances(company_id,warehouse_id,product_id,quantity,updated_at,variant_id)
     values(p_company_id,p_warehouse_id,pid,qty,timezone('utc',now()),null)
     on conflict(warehouse_id,product_id) do update set quantity=excluded.quantity,updated_at=excluded.updated_at;
   else
     insert into public.variant_stock_balances(company_id,warehouse_id,product_id,variant_id,quantity,updated_at)
     values(p_company_id,p_warehouse_id,pid,vid,qty,timezone('utc',now()))
     on conflict(company_id,warehouse_id,variant_id) do update set quantity=excluded.quantity,updated_at=excluded.updated_at;
   end if;
 end loop;
 update public.inventory_audits set status='approved',reviewed_by=v_auth,reviewed_at=timezone('utc',now()),notes=concat_ws(' | ',notes,nullif(p_notes,'')),updated_at=timezone('utc',now()) where id=p_audit_id and company_id=p_company_id;
 return jsonb_build_object('success',true,'id',p_audit_id);
end;
$$;

create table if not exists public.company_fiscal_sequences(
 company_id uuid not null references public.companies(id) on delete cascade,
 fiscal_type text not null,prefix text not null,next_number bigint not null default 1,limit_number bigint not null default 99999999,
 updated_at timestamptz not null default timezone('utc',now()),primary key(company_id,fiscal_type)
);
create table if not exists public.company_fiscal_reservations(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 fiscal_type text not null,device_id uuid null,start_number bigint not null,end_number bigint not null,created_by uuid null,
 created_at timestamptz not null default timezone('utc',now())
);
alter table public.company_fiscal_sequences enable row level security;
alter table public.company_fiscal_reservations enable row level security;

create or replace function public.palmyra_reserve_ncf_range(p_company_id uuid,p_fiscal_type text,p_device_id uuid,p_block_size integer)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); v_prefix text; v_limit bigint; v_next bigint; v_start bigint; v_end bigint; v_res uuid;
begin
 if v_auth is null then raise exception 'authentication_required'; end if;
 if not private.has_company_access(p_company_id) or not private.has_permission(p_company_id,'pos.access') then raise exception 'permission_denied'; end if;
 select q.x->>'prefix',coalesce((q.x->>'limit')::bigint,99999999) into v_prefix,v_limit
 from (select jsonb_array_elements(coalesce((select settings->'storeConfig'->'fiscalConfigs' from public.company_catalogs where company_id=p_company_id),'[]'::jsonb)) x) q
 where q.x->>'type'=p_fiscal_type limit 1;
 v_prefix:=coalesce(v_prefix,p_fiscal_type); v_limit:=coalesce(v_limit,99999999);
 perform pg_advisory_xact_lock(hashtext(p_company_id::text||':'||p_fiscal_type));
 insert into public.company_fiscal_sequences(company_id,fiscal_type,prefix,next_number,limit_number)
 values(p_company_id,p_fiscal_type,v_prefix,1,v_limit)
 on conflict(company_id,fiscal_type) do nothing;
 select next_number,limit_number,prefix into v_next,v_limit,v_prefix from public.company_fiscal_sequences where company_id=p_company_id and fiscal_type=p_fiscal_type for update;
 if v_next>v_limit then raise exception 'ncf_range_exhausted'; end if;
 v_start:=v_next; v_end:=least(v_limit,v_start+greatest(coalesce(p_block_size,100),1)-1);
 update public.company_fiscal_sequences set next_number=v_end+1,updated_at=timezone('utc',now()),prefix=v_prefix,limit_number=v_limit where company_id=p_company_id and fiscal_type=p_fiscal_type;
 insert into public.company_fiscal_reservations(company_id,fiscal_type,device_id,start_number,end_number,created_by) values(p_company_id,p_fiscal_type,p_device_id,v_start,v_end,v_auth) returning id into v_res;
 return jsonb_build_object('success',true,'range_id',v_res,'prefix',v_prefix,'start_number',v_start,'end_number',v_end);
end;
$$;

grant execute on function public.palmyra_record_sale(uuid,uuid,uuid,uuid,uuid,numeric,text,text,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.palmyra_void_sale(uuid,uuid,text) to authenticated;
grant execute on function public.palmyra_transfer_inventory(uuid,uuid,uuid,uuid,uuid,uuid,numeric,text) to authenticated;
grant execute on function public.palmyra_receive_purchase(uuid,uuid) to authenticated;
grant execute on function public.palmyra_open_cash_session(uuid,uuid,uuid,uuid,numeric,timestamptz) to authenticated;
grant execute on function public.palmyra_close_cash_session(uuid,uuid,timestamptz,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.palmyra_cancel_cash_session(uuid,uuid,text) to authenticated;
grant execute on function public.palmyra_create_return(uuid,uuid,uuid,uuid,numeric,text,numeric,text) to authenticated;
grant execute on function public.palmyra_complete_return(uuid,uuid) to authenticated;
grant execute on function public.palmyra_start_audit(uuid,uuid,uuid,text,boolean) to authenticated;
grant execute on function public.palmyra_save_audit_count(uuid,uuid,jsonb,text) to authenticated;
grant execute on function public.palmyra_request_audit_recount(uuid,uuid,text) to authenticated;
grant execute on function public.palmyra_approve_audit(uuid,uuid,text) to authenticated;
grant execute on function public.palmyra_complete_audit(uuid,uuid,uuid,jsonb,text) to authenticated;
grant execute on function public.palmyra_reserve_ncf_range(uuid,text,uuid,integer) to authenticated;
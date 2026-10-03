-- Serialize inventory-audit starts per branch to prevent duplicate active audits during reconnects.
create or replace function public.start_inventory_audit_v2(
  p_audit_id text, p_branch_id text, p_user_id text, p_mode text, p_blind_count boolean, p_notes text
) returns jsonb
language plpgsql
set search_path=public,pg_temp
as $function$
declare
  a RECORD; inv RECORD; prod RECORD; item_json jsonb;
begin
  if nullif(btrim(p_audit_id),'') is null then raise exception 'ID de auditoría requerido' using errcode='P0001'; end if;
  if nullif(btrim(p_branch_id),'') is null then raise exception 'Sucursal requerida' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('inventory-audit-start:'||p_branch_id));

  select * into a from public.inventory_audits
  where branch_id=p_branch_id and status='pending'
    and coalesce(review_status,'counting') in ('counting','pending_approval','recount_requested')
  order by created_at desc limit 1;

  if found and a.id<>p_audit_id then
    return jsonb_build_object('success',true,'already_exists',true,'audit_id',a.id,'review_status',coalesce(a.review_status,'counting'));
  end if;

  insert into public.inventory_audits(
    id,date,branch_id,user_id,status,items,notes,mode,blind_count,snapshot_at,review_status,counted_by,recount_count
  ) values(
    p_audit_id,now(),p_branch_id,p_user_id,'pending','[]'::jsonb,p_notes,
    case when p_mode in ('physical','cycle_count') then p_mode else 'cycle_count' end,
    coalesce(p_blind_count,false),now(),'counting',p_user_id,0
  )
  on conflict(id) do update set
    branch_id=excluded.branch_id,user_id=excluded.user_id,notes=excluded.notes,mode=excluded.mode,
    blind_count=excluded.blind_count,snapshot_at=coalesce(public.inventory_audits.snapshot_at,excluded.snapshot_at),
    review_status=case when public.inventory_audits.status='completed' then public.inventory_audits.review_status else 'counting' end,
    counted_by=excluded.counted_by;

  delete from public.inventory_audit_items where audit_id=p_audit_id;

  for prod in
    select id,name from public.products
    where coalesce(status,'active') <> 'discontinued'
    order by name,id
  loop
    for inv in
      select coalesce(variant_label,'') variant_label,quantity
      from public.inventory where branch_id=p_branch_id and product_id=prod.id
      order by coalesce(variant_label,'')
    loop
      insert into public.inventory_audit_items(
        id,audit_id,product_id,product_name,variant_label,expected,actual,counted,
        difference,system_at_submission,adjustment_delta,count_cycle
      ) values(
        gen_random_uuid()::text,p_audit_id,prod.id,coalesce(prod.name,'Producto'),
        inv.variant_label,coalesce(inv.quantity,0),null,null,0,coalesce(inv.quantity,0),0,1
      );
    end loop;

    if not exists (select 1 from public.inventory where branch_id=p_branch_id and product_id=prod.id) then
      insert into public.inventory_audit_items(
        id,audit_id,product_id,product_name,variant_label,expected,actual,counted,
        difference,system_at_submission,adjustment_delta,count_cycle
      ) values(
        gen_random_uuid()::text,p_audit_id,prod.id,coalesce(prod.name,'Producto'),
        '',0,null,null,0,0,0,1
      );
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productId',iai.product_id,'productName',iai.product_name,'variantLabel',iai.variant_label,
    'expected',iai.expected,'counted',iai.counted,'actual',iai.actual,'difference',iai.difference,
    'systemAtSubmission',iai.system_at_submission,'adjustmentDelta',iai.adjustment_delta,'countCycle',iai.count_cycle
  ) order by iai.product_name,iai.variant_label),'[]'::jsonb)
  into item_json from public.inventory_audit_items iai where iai.audit_id=p_audit_id;

  update public.inventory_audits set items=item_json where id=p_audit_id;

  insert into public.audit_log(user_id,action,entity_type,entity_id,meta)
  values(p_user_id,'START_INVENTORY_AUDIT','inventory_audit',p_audit_id,
    jsonb_build_object('branch_id',p_branch_id,'mode',p_mode,'blind_count',p_blind_count,'snapshot_at',now(),'line_count',jsonb_array_length(item_json)));

  return jsonb_build_object('success',true,'audit_id',p_audit_id,'items',item_json,'snapshot_at',now());
end
$function$;
-- Harden inventory transfer idempotency: reuse of an operation_id with a
-- different payload must be rejected instead of being accepted as already done.

create or replace function public.process_inventory_transfer_v2(
  p_operation_id text, p_batch_id text, p_product_id text,
  p_from_branch_id text, p_to_branch_id text, p_variants jsonb, p_user_id text
)
returns jsonb
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v RECORD;
  src public.inventory%rowtype;
  v_user public.users%rowtype;
  v_from public.branches%rowtype;
  v_to public.branches%rowtype;
  v_existing public.inventory_transfers%rowtype;
  v_requested_variants jsonb;
  v_existing_variants jsonb;
  v_has_source_access boolean := false;
  first_branch text;
  second_branch text;
  v_requested_quantity integer;
begin
  if nullif(btrim(p_operation_id),'') is null then raise exception 'ID de operación requerido' using errcode='P0001'; end if;
  if nullif(btrim(p_product_id),'') is null then raise exception 'Producto requerido' using errcode='P0001'; end if;
  if p_from_branch_id is null or p_to_branch_id is null then raise exception 'Origen y destino son obligatorios' using errcode='P0001'; end if;
  if p_from_branch_id=p_to_branch_id then raise exception 'Origen y destino no pueden coincidir' using errcode='P0001'; end if;
  if jsonb_typeof(coalesce(p_variants,'[]'::jsonb)) <> 'array' then raise exception 'Las variantes deben ser un arreglo' using errcode='P0001'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('variant_label',coalesce(x.variant_label,''),'quantity',x.quantity) order by x.variant_label),'[]'::jsonb),
         coalesce(sum(x.quantity),0)::integer
  into v_requested_variants, v_requested_quantity
  from (
    select coalesce(y.variant_label,'') as variant_label, sum(y.quantity)::integer as quantity
    from jsonb_to_recordset(p_variants) as y(variant_label text,quantity integer)
    group by coalesce(y.variant_label,'')
  ) x;

  if coalesce(nullif(btrim(p_user_id),''),'system') <> 'system' then
    select * into v_user from public.users where id=p_user_id limit 1;
    if not found or v_user.is_active is distinct from true then raise exception 'El trabajador no está activo o no existe' using errcode='42501'; end if;
  end if;

  select * into v_from from public.branches where id=p_from_branch_id limit 1;
  if not found or v_from.is_active is distinct from true then raise exception 'La sucursal de origen no está activa o no existe' using errcode='42501'; end if;
  select * into v_to from public.branches where id=p_to_branch_id limit 1;
  if not found or v_to.is_active is distinct from true then raise exception 'La sucursal de destino no está activa o no existe' using errcode='42501'; end if;

  if coalesce(nullif(btrim(p_user_id),''),'system') <> 'system' then
    if v_user.role = 'admin' then v_has_source_access := true;
    else
      v_has_source_access :=
        coalesce(v_user.assigned_branch_id = p_from_branch_id, false)
        or coalesce(v_user.branch_id = p_from_branch_id, false)
        or coalesce(p_from_branch_id = any(coalesce(v_user.allowed_branches,array[]::text[])), false);
    end if;
    if not v_has_source_access then raise exception 'El trabajador no tiene autorizada la sucursal de origen' using errcode='42501'; end if;
  end if;

  if not exists (select 1 from public.products where id=p_product_id) then raise exception 'El producto no existe' using errcode='P0001'; end if;

  select * into v_existing from public.inventory_transfers where operation_id=p_operation_id for update;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object('variant_label',coalesce(x.variant_label,''),'quantity',x.quantity) order by x.variant_label),'[]'::jsonb)
    into v_existing_variants
    from (
      select coalesce(y.variant_label,'') as variant_label, sum(y.quantity)::integer as quantity
      from jsonb_to_recordset(coalesce(v_existing.variants,'[]'::jsonb)) as y(variant_label text,quantity integer)
      group by coalesce(y.variant_label,'')
    ) x;

    if v_existing.product_id is distinct from p_product_id
       or v_existing.from_branch_id is distinct from p_from_branch_id
       or v_existing.to_branch_id is distinct from p_to_branch_id
       or coalesce(v_existing.batch_id,'') is distinct from coalesce(nullif(btrim(p_batch_id),'') ,'')
       or v_existing.quantity is distinct from v_requested_quantity
       or v_existing_variants is distinct from v_requested_variants then
      raise exception 'Conflicto de idempotencia: el operation_id % ya pertenece a una transferencia diferente',p_operation_id using errcode='P0001';
    end if;

    return jsonb_build_object('success',true,'operation_id',p_operation_id,'batch_id',p_batch_id,'already_existed',true);
  end if;

  if v_requested_quantity <= 0 then raise exception 'Debes indicar al menos una cantidad mayor que 0 para transferir' using errcode='P0001'; end if;

  if p_from_branch_id<p_to_branch_id then first_branch:=p_from_branch_id; second_branch:=p_to_branch_id;
  else first_branch:=p_to_branch_id; second_branch:=p_from_branch_id; end if;

  perform pg_advisory_xact_lock(hashtext('transfer:'||p_product_id||':'||first_branch));
  perform pg_advisory_xact_lock(hashtext('transfer:'||p_product_id||':'||second_branch));

  for v in
    select coalesce(x.variant_label,'') as variant_label,sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_variants) as x(variant_label text,quantity integer)
    group by coalesce(x.variant_label,'')
  loop
    if v.quantity<=0 then raise exception 'Cantidad inválida en transferencia' using errcode='P0001'; end if;
    select * into src from public.inventory
    where product_id=p_product_id and branch_id=p_from_branch_id and coalesce(variant_label,'')=v.variant_label
    for update;
    if not found then raise exception 'No existe stock origen para variante %',v.variant_label using errcode='P0001'; end if;
    if src.quantity<v.quantity then raise exception 'Stock insuficiente en origen: disponible %, requerido %',src.quantity,v.quantity using errcode='P0001'; end if;
  end loop;

  for v in
    select coalesce(x.variant_label,'') as variant_label,sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_variants) as x(variant_label text,quantity integer)
    group by coalesce(x.variant_label,'')
  loop
    update public.inventory set quantity=quantity-v.quantity
    where product_id=p_product_id and branch_id=p_from_branch_id and coalesce(variant_label,'')=v.variant_label;
    insert into public.inventory_movements(product_id,branch_id,variant_label,quantity_delta,movement_type,reference_id,user_id,metadata)
    values(p_product_id,p_from_branch_id,v.variant_label,-v.quantity,'TRANSFER_OUT',p_operation_id,nullif(p_user_id,'system'),jsonb_build_object('batch_id',p_batch_id));

    update public.inventory set quantity=quantity+v.quantity
    where product_id=p_product_id and branch_id=p_to_branch_id and coalesce(variant_label,'')=v.variant_label;
    if not found then
      insert into public.inventory(product_id,branch_id,variant_label,quantity,min_quantity,id)
      values(p_product_id,p_to_branch_id,v.variant_label,v.quantity,5,gen_random_uuid()::text);
    end if;
    insert into public.inventory_movements(product_id,branch_id,variant_label,quantity_delta,movement_type,reference_id,user_id,metadata)
    values(p_product_id,p_to_branch_id,v.variant_label,v.quantity,'TRANSFER_IN',p_operation_id,nullif(p_user_id,'system'),jsonb_build_object('batch_id',p_batch_id));
  end loop;

  insert into public.inventory_transfers(
    id,operation_id,batch_id,product_id,product_name,from_branch_id,from_branch_name,
    to_branch_id,to_branch_name,variant_label,quantity,variants,date,user_id,status
  )
  select p_operation_id,p_operation_id,nullif(btrim(p_batch_id),''),
         p_product_id,p.name,p_from_branch_id,v_from.name,p_to_branch_id,v_to.name,
         coalesce((
           select string_agg(
             case when coalesce(x.variant_label,'')='' then 'Producto Base' else x.variant_label end || ': ' || x.quantity,
             ', ' order by case when coalesce(x.variant_label,'')='' then 0 else 1 end,x.variant_label)
           from (
             select coalesce(y.variant_label,'') variant_label,sum(y.quantity)::integer quantity
             from jsonb_to_recordset(p_variants) y(variant_label text,quantity integer)
             group by coalesce(y.variant_label,'')
           ) x
         ),'Producto Base'),
         v_requested_quantity,p_variants,now(),nullif(p_user_id,'system'),'completed'
  from public.products p where p.id=p_product_id;

  return jsonb_build_object('success',true,'operation_id',p_operation_id,'batch_id',p_batch_id);
end
$function$;
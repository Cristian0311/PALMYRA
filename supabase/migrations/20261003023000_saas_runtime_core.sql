-- PALMYRA POS SaaS runtime hardening
-- Canonical tenant model: companies -> warehouses/employees/products/sales/stock.

create or replace function private.normalize_permission_key(p_key text)
returns text
language sql
immutable
as $$
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
    when 'quotes.manage' then 'pos.access'
    when 'purchases.manage' then 'suppliers.manage'
    when 'audit.view' then 'reports.view'
    else lower(trim(coalesce(p_key,'')))
  end;
$$;

create or replace function private.has_permission(p_company_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where ur.company_id = p_company_id
      and ur.user_id = auth.uid()
      and p.key = private.normalize_permission_key(p_permission_key)
      and (r.is_system or r.company_id = p_company_id)
  );
$$;

create or replace function private.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_limit integer;
  v_count integer;
  v_kind text;
  v_company_id uuid;
  v_will_count boolean := false;
begin
  if TG_OP = 'DELETE' then
    return old;
  end if;

  v_company_id := new.company_id;
  if v_company_id is null then
    raise exception 'company_required';
  end if;

  if TG_TABLE_NAME = 'products' then
    v_kind := 'products';
    v_will_count := new.status is distinct from 'archived';
    if TG_OP = 'UPDATE' and old.status is distinct from 'archived' then
      v_will_count := false;
    end if;
  elsif TG_TABLE_NAME = 'warehouses' then
    v_kind := 'warehouses';
    v_will_count := coalesce(new.active, true);
    if TG_OP = 'UPDATE' and coalesce(old.active, true) then
      v_will_count := false;
    end if;
  elsif TG_TABLE_NAME = 'employees' then
    v_kind := 'employees';
    v_will_count := coalesce(new.active, true);
    if TG_OP = 'UPDATE' and coalesce(old.active, true) then
      v_will_count := false;
    end if;
  else
    return new;
  end if;

  if not v_will_count then
    return new;
  end if;

  select coalesce((p.limits ->> v_kind)::int, 999999)
    into v_limit
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.company_id = v_company_id
    and s.status in ('active','trialing','past_due')
  order by s.updated_at desc nulls last
  limit 1;

  v_limit := coalesce(v_limit, 0);

  if TG_TABLE_NAME = 'products' then
    select count(*) into v_count
    from public.products p
    where p.company_id = v_company_id
      and p.status is distinct from 'archived';
  elsif TG_TABLE_NAME = 'warehouses' then
    select count(*) into v_count
    from public.warehouses w
    where w.company_id = v_company_id
      and w.active;
  else
    select count(*) into v_count
    from public.employees e
    where e.company_id = v_company_id
      and e.active;
  end if;

  if v_count >= v_limit then
    raise exception 'plan_%_limit', v_kind using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_plan_limit_products on public.products;
create trigger trg_plan_limit_products
before insert or update of company_id,status on public.products
for each row execute function private.enforce_plan_limit();

drop trigger if exists trg_plan_limit_warehouses on public.warehouses;
create trigger trg_plan_limit_warehouses
before insert or update of company_id,active on public.warehouses
for each row execute function private.enforce_plan_limit();

drop trigger if exists trg_plan_limit_employees on public.employees;
create trigger trg_plan_limit_employees
before insert or update of company_id,active on public.employees
for each row execute function private.enforce_plan_limit();

create or replace function public.palmyra_record_sale(
  p_sale_id uuid,
  p_company_id uuid,
  p_warehouse_id uuid,
  p_cash_session_id uuid,
  p_user_id uuid,
  p_total numeric,
  p_currency_code text,
  p_notes text,
  p_customer_id uuid,
  p_items jsonb,
  p_payments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.sales%rowtype;
  v_sale public.sales%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty numeric;
  v_price numeric;
  v_discount numeric;
  v_tax numeric;
  v_line_total numeric;
  v_stock numeric;
  v_employee_id uuid;
  v_default_currency text;
  v_register_company uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
  if not private.has_permission(p_company_id,'pos.access') then raise exception 'permission_denied'; end if;

  if not exists (
    select 1 from public.warehouses
    where id=p_warehouse_id and company_id=p_company_id and active
  ) then raise exception 'invalid_warehouse'; end if;

  if p_cash_session_id is not null then
    select cr.company_id into v_register_company
    from public.cash_sessions cs join public.cash_registers cr on cr.id=cs.cash_register_id
    where cs.id=p_cash_session_id and cs.company_id=p_company_id and cr.warehouse_id=p_warehouse_id;
    if v_register_company is null then raise exception 'invalid_cash_session'; end if;
  end if;

  if p_user_id is not null then
    select e.id into v_employee_id
    from public.employees e
    where e.company_id=p_company_id
      and e.active
      and (e.id=p_user_id or e.user_id=p_user_id)
    order by (e.id=p_user_id) desc
    limit 1;
  end if;

  select c.default_currency_code into v_default_currency
  from public.companies c where c.id=p_company_id;

  select * into v_existing from public.sales where id=p_sale_id and company_id=p_company_id limit 1;
  if found then
    return jsonb_build_object('success',true,'id',v_existing.id,'already_existed',true);
  end if;

  insert into public.sales(
    id,company_id,warehouse_id,cash_session_id,employee_id,seller_user_id,status,total,
    currency_code,client_name,notes,source_operation_id,customer_id
  )
  values(
    p_sale_id,p_company_id,p_warehouse_id,p_cash_session_id,v_employee_id,v_user,
    'completed',coalesce(p_total,0),coalesce(nullif(p_currency_code,''),v_default_currency),
    null,coalesce(p_notes,''),p_sale_id,p_customer_id
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_qty := greatest(coalesce((v_item->>'quantity')::numeric,0),0);
    v_price := coalesce((v_item->>'price')::numeric,0);
    v_discount := coalesce((v_item->>'discount')::numeric,0);
    v_tax := coalesce((v_item->>'tax')::numeric,0);
    v_line_total := coalesce((v_item->>'total')::numeric, v_price*v_qty);

    if v_product_id is null or v_qty <= 0 then
      raise exception 'invalid_sale_item';
    end if;

    if not exists (
      select 1 from public.products p
      where p.id=v_product_id and p.company_id=p_company_id and p.status is distinct from 'archived'
    ) then raise exception 'invalid_product'; end if;

    v_variant_id := null;
    if nullif(trim(coalesce(v_item->>'variant_id',v_item->>'variantId','')),'') is not null then
      v_variant_id := (coalesce(v_item->>'variant_id',v_item->>'variantId'))::uuid;
    elsif nullif(trim(coalesce(v_item->>'variant_label',v_item->>'variantLabel','')),'') is not null then
      select pv.id into v_variant_id
      from public.product_variants pv
      where pv.company_id=p_company_id and pv.product_id=v_product_id
        and pv.name=coalesce(v_item->>'variant_label',v_item->>'variantLabel')
        and pv.active
      limit 1;
    end if;

    insert into public.sale_items(
      id,sale_id,product_id,variant_id,quantity,unit_price,discount,tax,line_total,serial_number
    )
    values(
      coalesce(nullif(v_item->>'id','')::uuid,gen_random_uuid()),
      p_sale_id,v_product_id,v_variant_id,v_qty,v_price,v_discount,v_tax,v_line_total,
      nullif(v_item->>'serial_number',v_item->>'serialNumber')
    );

    if coalesce((select track_stock from public.products where id=v_product_id),true) then
      if v_variant_id is null then
        select quantity into v_stock
        from public.stock_balances
        where company_id=p_company_id and warehouse_id=p_warehouse_id and product_id=v_product_id and variant_id is null
        for update;
        if not found then raise exception 'stock_record_missing'; end if;
        if v_stock < v_qty then raise exception 'insufficient_stock'; end if;
        update public.stock_balances
        set quantity=quantity-v_qty,updated_at=timezone('utc',now())
        where company_id=p_company_id and warehouse_id=p_warehouse_id and product_id=v_product_id and variant_id is null;
      else
        select quantity into v_stock
        from public.variant_stock_balances
        where company_id=p_company_id and warehouse_id=p_warehouse_id and product_id=v_product_id and variant_id=v_variant_id
        for update;
        if not found then raise exception 'variant_stock_record_missing'; end if;
        if v_stock < v_qty then raise exception 'insufficient_stock'; end if;
        update public.variant_stock_balances
        set quantity=quantity-v_qty,updated_at=timezone('utc',now())
        where company_id=p_company_id and warehouse_id=p_warehouse_id and product_id=v_product_id and variant_id=v_variant_id;
      end if;

      insert into public.stock_movements(
        id,company_id,warehouse_id,product_id,movement_type,quantity,reference_type,reference_id,created_by,occurred_at,variant_id
      )
      values(
        gen_random_uuid(),p_company_id,p_warehouse_id,v_product_id,'sale',-v_qty,'sale',p_sale_id,v_user,timezone('utc',now()),v_variant_id
      );
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payments,'[]'::jsonb)) loop
    insert into public.payments(
      id,company_id,sale_id,method,currency_code,amount,exchange_rate,reference,created_by
    )
    values(
      coalesce(nullif(v_item->>'id','')::uuid,gen_random_uuid()),
      p_company_id,p_sale_id,coalesce(v_item->>'method','cash'),
      coalesce(v_item->>'currency_code',v_item->>'currencyCode',v_default_currency),
      coalesce((v_item->>'amount')::numeric,0),
      coalesce((v_item->>'exchange_rate')::numeric,(v_item->>'exchangeRate')::numeric,1),
      nullif(v_item->>'reference',''),
      v_user
    );
  end loop;

  return jsonb_build_object('success',true,'id',p_sale_id,'already_existed',false);
exception
  when unique_violation then
    select * into v_existing from public.sales where id=p_sale_id and company_id=p_company_id limit 1;
    if found then
      return jsonb_build_object('success',true,'id',v_existing.id,'already_existed',true);
    end if;
    raise;
end;
$$;

create or replace function public.palmyra_void_sale(
  p_sale_id uuid,
  p_company_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_item record;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
  if not private.has_permission(p_company_id,'sales.refund') then raise exception 'permission_denied'; end if;

  select * into v_sale from public.sales where id=p_sale_id and company_id=p_company_id for update;
  if not found then raise exception 'sale_not_found'; end if;
  if v_sale.status in ('refunded','cancelled') then
    return jsonb_build_object('success',true,'already_refunded',true);
  end if;

  for v_item in
    select si.product_id,si.variant_id,si.quantity
    from public.sale_items si where si.sale_id=p_sale_id
  loop
    if v_item.variant_id is null then
      insert into public.stock_balances(company_id,warehouse_id,product_id,variant_id,quantity,updated_at)
      values(p_company_id,v_sale.warehouse_id,v_item.product_id,null,v_item.quantity,timezone('utc',now()))
      on conflict (company_id,warehouse_id,product_id,variant_id)
      do update set quantity=public.stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
    else
      insert into public.variant_stock_balances(company_id,warehouse_id,product_id,variant_id,quantity,updated_at)
      values(p_company_id,v_sale.warehouse_id,v_item.product_id,v_item.variant_id,v_item.quantity,timezone('utc',now()))
      on conflict (company_id,warehouse_id,product_id,variant_id)
      do update set quantity=public.variant_stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
    end if;

    insert into public.stock_movements(
      id,company_id,warehouse_id,product_id,movement_type,quantity,reference_type,reference_id,created_by,occurred_at,variant_id,note
    )
    values(
      gen_random_uuid(),p_company_id,v_sale.warehouse_id,v_item.product_id,'return',v_item.quantity,
      'sale_void',p_sale_id,v_user,timezone('utc',now()),v_item.variant_id,coalesce(p_reason,'Anulación')
    );
  end loop;

  update public.sales
  set status='refunded',notes=concat_ws(E'\n',nullif(notes,''),coalesce(p_reason,'Anulación')),updated_at=timezone('utc',now())
  where id=p_sale_id;

  return jsonb_build_object('success',true,'already_refunded',false);
end;
$$;

create or replace function public.palmyra_transfer_inventory(
  p_operation_id uuid,
  p_company_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity numeric,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_source numeric;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
  if not private.has_permission(p_company_id,'inventory.transfer') then raise exception 'permission_denied'; end if;
  if p_from_warehouse_id=p_to_warehouse_id or p_quantity<=0 then raise exception 'invalid_transfer'; end if;
  if not exists(select 1 from public.warehouses where id=p_from_warehouse_id and company_id=p_company_id and active)
    or not exists(select 1 from public.warehouses where id=p_to_warehouse_id and company_id=p_company_id and active)
    then raise exception 'invalid_warehouse'; end if;
  if not exists(select 1 from public.products where id=p_product_id and company_id=p_company_id and status is distinct from 'archived')
    then raise exception 'invalid_product'; end if;

  if p_variant_id is null then
    select quantity into v_source
    from public.stock_balances
    where company_id=p_company_id and warehouse_id=p_from_warehouse_id and product_id=p_product_id and variant_id is null
    for update;
    if not found or v_source < p_quantity then raise exception 'insufficient_stock'; end if;
    update public.stock_balances set quantity=quantity-p_quantity,updated_at=timezone('utc',now())
    where company_id=p_company_id and warehouse_id=p_from_warehouse_id and product_id=p_product_id and variant_id is null;
    insert into public.stock_balances(company_id,warehouse_id,product_id,variant_id,quantity,updated_at)
    values(p_company_id,p_to_warehouse_id,p_product_id,null,p_quantity,timezone('utc',now()))
    on conflict (company_id,warehouse_id,product_id,variant_id)
    do update set quantity=public.stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
  else
    select quantity into v_source
    from public.variant_stock_balances
    where company_id=p_company_id and warehouse_id=p_from_warehouse_id and product_id=p_product_id and variant_id=p_variant_id
    for update;
    if not found or v_source < p_quantity then raise exception 'insufficient_stock'; end if;
    update public.variant_stock_balances set quantity=quantity-p_quantity,updated_at=timezone('utc',now())
    where company_id=p_company_id and warehouse_id=p_from_warehouse_id and product_id=p_product_id and variant_id=p_variant_id;
    insert into public.variant_stock_balances(company_id,warehouse_id,product_id,variant_id,quantity,updated_at)
    values(p_company_id,p_to_warehouse_id,p_product_id,p_variant_id,p_quantity,timezone('utc',now()))
    on conflict (company_id,warehouse_id,product_id,variant_id)
    do update set quantity=public.variant_stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
  end if;

  insert into public.transfers(id,company_id,origin_warehouse_id,destination_warehouse_id,status,notes,created_by)
  values(p_operation_id,p_company_id,p_from_warehouse_id,p_to_warehouse_id,'completed',p_notes,v_user)
  on conflict (id) do nothing;

  insert into public.transfer_items(id,transfer_id,product_id,quantity,variant_id)
  values(gen_random_uuid(),p_operation_id,p_product_id,p_quantity,p_variant_id);

  insert into public.stock_movements(id,company_id,warehouse_id,product_id,movement_type,quantity,reference_type,reference_id,created_by,occurred_at,variant_id,note)
  values
    (gen_random_uuid(),p_company_id,p_from_warehouse_id,p_product_id,'transfer',-p_quantity,'transfer',p_operation_id,v_user,timezone('utc',now()),p_variant_id,p_notes),
    (gen_random_uuid(),p_company_id,p_to_warehouse_id,p_product_id,'transfer',p_quantity,'transfer',p_operation_id,v_user,timezone('utc',now()),p_variant_id,p_notes);

  return jsonb_build_object('success',true,'id',p_operation_id);
end;
$$;

create or replace function public.palmyra_receive_purchase(
  p_order_id uuid,
  p_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_order public.purchase_orders%rowtype;
  v_item record;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if not private.has_company_access(p_company_id) then raise exception 'company_access_denied'; end if;
  if not private.has_permission(p_company_id,'purchases.manage') then raise exception 'permission_denied'; end if;
  select * into v_order from public.purchase_orders where id=p_order_id and company_id=p_company_id for update;
  if not found then raise exception 'purchase_order_not_found'; end if;
  if v_order.status='received' then return jsonb_build_object('success',true,'already_received',true); end if;

  for v_item in select * from public.purchase_items where purchase_order_id=p_order_id loop
    insert into public.stock_balances(company_id,warehouse_id,product_id,variant_id,quantity,updated_at)
    values(p_company_id,v_order.warehouse_id,v_item.product_id,null,v_item.quantity,timezone('utc',now()))
    on conflict (company_id,warehouse_id,product_id,variant_id)
    do update set quantity=public.stock_balances.quantity+excluded.quantity,updated_at=excluded.updated_at;
    insert into public.stock_movements(id,company_id,warehouse_id,product_id,movement_type,quantity,reference_type,reference_id,created_by,occurred_at,note)
    values(gen_random_uuid(),p_company_id,v_order.warehouse_id,v_item.product_id,'purchase',v_item.quantity,'purchase_order',p_order_id,v_user,timezone('utc',now()),'Recepción de compra');
  end loop;

  update public.purchase_orders
  set status='received',updated_at=timezone('utc',now())
  where id=p_order_id;

  return jsonb_build_object('success',true,'already_received',false);
end;
$$;

grant execute on function public.palmyra_record_sale(uuid,uuid,uuid,uuid,uuid,numeric,text,text,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.palmyra_void_sale(uuid,uuid,text) to authenticated;
grant execute on function public.palmyra_transfer_inventory(uuid,uuid,uuid,uuid,uuid,uuid,numeric,text) to authenticated;
grant execute on function public.palmyra_receive_purchase(uuid,uuid) to authenticated;

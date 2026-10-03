alter table public.company_catalogs
  add column if not exists settings jsonb not null default '{}'::jsonb;

create or replace function public.create_employee_secure(
  p_company_id uuid,
  p_employee_id uuid,
  p_employee_code text,
  p_full_name text,
  p_base_salary numeric,
  p_role_id uuid,
  p_warehouse_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_id uuid := coalesce(p_employee_id, gen_random_uuid());
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if not private.has_permission(p_company_id,'employees.manage') then raise exception 'permission_denied'; end if;
  if length(trim(p_full_name))<2 or length(trim(p_full_name))>160 then raise exception 'invalid_employee_name'; end if;
  if length(trim(p_employee_code))<1 or length(trim(p_employee_code))>50 then raise exception 'invalid_employee_code'; end if;
  if p_base_salary is null or p_base_salary<0 then raise exception 'invalid_salary'; end if;
  if p_warehouse_ids is null or cardinality(p_warehouse_ids)=0 then raise exception 'warehouse_required'; end if;
  if not exists(select 1 from public.roles r where r.id=p_role_id and (r.company_id is null or r.company_id=p_company_id) and r.key<>'admin') then raise exception 'invalid_role'; end if;
  if exists(select 1 from public.employees e where e.id=v_id and e.company_id<>p_company_id) then raise exception 'employee_id_conflict'; end if;
  select coalesce((p.limits->>'employees')::int,999999) into v_limit
  from public.subscriptions s join public.plans p on p.id=s.plan_id
  where s.company_id=p_company_id and s.status in ('active','trialing','past_due')
  order by s.updated_at desc nulls last limit 1;
  if not exists(select 1 from public.employees e where e.id=v_id) and
     (select count(*) from public.employees e where e.company_id=p_company_id and e.active) >= coalesce(v_limit,0) then
    raise exception 'plan_employee_limit' using errcode='P0001';
  end if;
  if (select count(*) from public.warehouses w where w.id=any(p_warehouse_ids) and w.company_id=p_company_id and w.active)<>cardinality(p_warehouse_ids) then
    raise exception 'invalid_warehouse';
  end if;
  insert into public.employees(id,company_id,employee_code,full_name,base_salary,active,role_id)
  values(v_id,p_company_id,upper(trim(p_employee_code)),trim(p_full_name),p_base_salary,true,p_role_id)
  on conflict(id) do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    base_salary=excluded.base_salary,
    active=true,
    role_id=excluded.role_id,
    updated_at=timezone('utc',now());
  delete from public.employee_warehouse_access where employee_id=v_id and company_id=p_company_id;
  insert into public.employee_warehouse_access(company_id,employee_id,warehouse_id,is_default)
  select p_company_id,v_id,wid,(row_number() over(order by wid))=1
  from unnest(p_warehouse_ids) as wid;
  return jsonb_build_object('id',v_id);
exception when unique_violation then
  raise exception 'employee_code_taken';
end;
$$;

grant execute on function public.create_employee_secure(uuid,uuid,text,text,numeric,uuid,uuid[]) to authenticated;

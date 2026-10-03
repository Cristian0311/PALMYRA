-- Operational authorization for inventory mutations.
-- Keeps the existing RPC signatures and only adds an active-user + branch-access
-- guard before stock/audit modifications.

create or replace function public.assert_pos_inventory_operator_access(
  p_user_id text, p_branch_id text
) returns void
language plpgsql
set search_path=public,pg_temp
as $function$
declare
  v_user public.users%rowtype;
  v_branch public.branches%rowtype;
  v_has_access boolean:=false;
begin
  if nullif(btrim(p_user_id),'') is null or lower(btrim(p_user_id))='system' then
    raise exception 'Se requiere un trabajador autenticado para modificar inventario' using errcode='42501';
  end if;
  select * into v_user from public.users where id=p_user_id limit 1;
  if not found or v_user.is_active is distinct from true then
    raise exception 'El trabajador no está activo o no existe' using errcode='42501';
  end if;
  select * into v_branch from public.branches where id=p_branch_id limit 1;
  if not found or v_branch.is_active is distinct from true then
    raise exception 'La sucursal no está activa o no existe' using errcode='42501';
  end if;
  if v_user.role='admin' then return; end if;
  v_has_access :=
    coalesce(v_user.assigned_branch_id=p_branch_id,false)
    or coalesce(v_user.branch_id=p_branch_id,false)
    or coalesce(p_branch_id=any(coalesce(v_user.allowed_branches,array[]::text[])),false);
  if not v_has_access then
    raise exception 'El trabajador no tiene autorización sobre esta sucursal' using errcode='42501';
  end if;
end;
$function$;

do $migration$
declare
  r record;
  def text;
  patched text;
begin
  for r in
    select p.oid,p.proname
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'apply_inventory_adjustment_v2',
        'reconcile_inventory_v2',
        'receive_supplier_order_v2',
        'start_inventory_audit_v2',
        'save_inventory_audit_count_v2',
        'approve_inventory_audit_v2'
      )
  loop
    def := pg_get_functiondef(r.oid);
    if strpos(def,'assert_pos_inventory_operator_access') > 0 then
      continue;
    end if;

    if r.proname in ('apply_inventory_adjustment_v2','reconcile_inventory_v2') then
      patched := replace(
        def,
        E'\nBEGIN\n',
        E'\nBEGIN\n  PERFORM public.assert_pos_inventory_operator_access(p_user_id,p_branch_id);\n'
      );
    elsif r.proname='receive_supplier_order_v2' then
      patched := replace(
        def,
        'branch:=o.branch_id;',
        'branch:=o.branch_id;\n  PERFORM public.assert_pos_inventory_operator_access(p_user_id,branch);'
      );
    elsif r.proname='start_inventory_audit_v2' then
      patched := replace(
        def,
        'if nullif(btrim(p_branch_id),'''') is null then raise exception ''Sucursal requerida'' using errcode=''P0001''; end if;',
        'if nullif(btrim(p_branch_id),'''') is null then raise exception ''Sucursal requerida'' using errcode=''P0001''; end if;\n  perform public.assert_pos_inventory_operator_access(p_user_id,p_branch_id);'
      );
    else
      patched := replace(
        def,
        'IF NOT FOUND THEN RAISE EXCEPTION ''Auditoría % no encontrada'',p_audit_id USING ERRCODE=''P0001''; END IF;',
        'IF NOT FOUND THEN RAISE EXCEPTION ''Auditoría % no encontrada'',p_audit_id USING ERRCODE=''P0001''; END IF;\n  PERFORM public.assert_pos_inventory_operator_access(p_user_id,a.branch_id);'
      );
    end if;

    if patched=def then
      raise exception 'No se pudo aplicar el guard de autorización a %',r.proname;
    end if;
    execute patched;
  end loop;
end
$migration$;
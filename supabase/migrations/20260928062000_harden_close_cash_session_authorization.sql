-- Hardens close_cash_session_v2 using the existing function signature.
-- The actor is read from p_settlement_data.userId and checked against the
-- session owner/participants and branch access before the close is committed.

create or replace function public.close_cash_session_v2(
  p_session_id text,
  p_closing_balances jsonb,
  p_closed_at timestamp with time zone,
  p_notes text,
  p_settlement_data jsonb
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  s record;
  v_settlement jsonb;
  v_settlement_id text;
  v_actor_id text;
  v_actor public.users%rowtype;
  v_has_branch_access boolean := false;
begin
  select * into s from public.cash_sessions where id=p_session_id for update;
  if not found then raise exception 'Turno % no encontrado',p_session_id using errcode='P0001'; end if;

  v_actor_id := nullif(btrim(p_settlement_data->>'userId'),'');
  if v_actor_id is null then v_actor_id := s.user_id; end if;

  select * into v_actor from public.users where id=v_actor_id limit 1;
  if not found or v_actor.is_active is distinct from true then
    raise exception 'El trabajador que intenta cerrar el turno no está activo o no existe' using errcode='42501';
  end if;

  if v_actor.role='admin' then
    v_has_branch_access := true;
  else
    v_has_branch_access :=
      coalesce(v_actor.assigned_branch_id=s.branch_id,false)
      or coalesce(v_actor.branch_id=s.branch_id,false)
      or coalesce(s.branch_id=any(coalesce(v_actor.allowed_branches,array[]::text[])),false)
      or coalesce(s.user_id=v_actor.id,false)
      or coalesce(v_actor.id=any(coalesce(s.working_employee_ids,array[]::text[])),false);
  end if;

  if not v_has_branch_access then
    raise exception 'El trabajador no tiene autorización para cerrar este turno' using errcode='42501';
  end if;

  if s.status='closed' then
    select row_to_json(ss.*)::jsonb into v_settlement from public.salary_settlements ss
    where ss.session_id=p_session_id order by ss.created_at desc limit 1;
    return jsonb_build_object(
      'success',true,'session_id',p_session_id,'already_closed',true,
      'settlement',v_settlement,
      'settlement_id',case when v_settlement is null then null else v_settlement->>'id' end
    );
  end if;

  if s.status='cancelled' then
    raise exception 'No se puede cerrar un turno cancelado' using errcode='P0001';
  end if;

  update public.cash_sessions
  set status='closed',closed_at=p_closed_at,closing_balances=p_closing_balances,notes=p_notes,updated_at=now()
  where id=p_session_id;

  select id into v_settlement_id from public.salary_settlements
  where session_id=p_session_id order by created_at desc limit 1;

  if v_settlement_id is null then
    v_settlement_id := coalesce(nullif(p_settlement_data->>'id',''),'salary-'||p_session_id);
    insert into public.salary_settlements(
      id,user_id,user_name,session_id,base_salary,sales_goal,commissions,total,date,status,created_at
    ) values(
      v_settlement_id,
      coalesce(nullif(p_settlement_data->>'userId',''),v_actor_id),
      p_settlement_data->>'userName',
      p_session_id,
      coalesce((p_settlement_data->>'baseSalary')::numeric,0),
      coalesce((p_settlement_data->>'salesGoal')::numeric,0),
      coalesce((p_settlement_data->>'commissions')::numeric,0),
      coalesce((p_settlement_data->>'total')::numeric,0),
      p_closed_at,
      coalesce(nullif(p_settlement_data->>'status',''),'pending'),
      now()
    )
    on conflict(id) do update set
      user_id=excluded.user_id,user_name=excluded.user_name,session_id=excluded.session_id,
      base_salary=excluded.base_salary,sales_goal=excluded.sales_goal,commissions=excluded.commissions,
      total=excluded.total,date=excluded.date,status=excluded.status;
  end if;

  insert into public.audit_log(user_id,action,entity_type,entity_id,meta)
  values(v_actor_id,'CLOSE_SESSION','cash_session',p_session_id,p_settlement_data);

  return jsonb_build_object('success',true,'session_id',p_session_id,'settlement_id',v_settlement_id);
end;
$function$;
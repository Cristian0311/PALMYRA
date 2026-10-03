-- Harden cash-session authorization and lock the internal repair backup table.
-- The POS itself does not reference the backup table.

CREATE OR REPLACE FUNCTION public.open_cash_session_v3(
  p_session_id text,
  p_user_id text,
  p_worker_name text,
  p_branch_id text,
  p_opening_amount numeric,
  p_opened_at timestamp with time zone,
  p_working_employee_ids text[],
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
  v_existing public.cash_sessions%rowtype;
  v_user public.users%rowtype;
  v_branch public.branches%rowtype;
  v_has_branch_access boolean := false;
BEGIN
  IF NULLIF(trim(p_session_id),'') IS NULL THEN
    RAISE EXCEPTION 'El ID del turno es obligatorio' USING ERRCODE='P0001';
  END IF;
  IF NULLIF(trim(p_branch_id),'') IS NULL THEN
    RAISE EXCEPTION 'La sucursal es obligatoria' USING ERRCODE='P0001';
  END IF;
  IF NULLIF(trim(p_user_id),'') IS NULL THEN
    RAISE EXCEPTION 'El usuario es obligatorio' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id=p_user_id LIMIT 1;
  IF NOT FOUND OR v_user.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'El trabajador no está activo o no existe' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_branch FROM public.branches WHERE id=p_branch_id LIMIT 1;
  IF NOT FOUND OR v_branch.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'La sucursal no está activa o no existe' USING ERRCODE='42501';
  END IF;

  IF v_user.role = 'admin' THEN
    v_has_branch_access := true;
  ELSE
    v_has_branch_access :=
      COALESCE(v_user.assigned_branch_id = p_branch_id, false)
      OR COALESCE(v_user.branch_id = p_branch_id, false)
      OR COALESCE(p_branch_id = ANY(COALESCE(v_user.allowed_branches, ARRAY[]::text[])), false);
  END IF;

  IF NOT v_has_branch_access THEN
    RAISE EXCEPTION 'El trabajador no tiene autorizada esta sucursal' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cash-session:'||p_branch_id));

  SELECT * INTO v_existing FROM public.cash_sessions WHERE id=p_session_id FOR UPDATE;

  IF FOUND THEN
    IF v_existing.branch_id IS DISTINCT FROM p_branch_id
       OR v_existing.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'El ID de turno ya pertenece a otra sesión' USING ERRCODE='P0001';
    END IF;
    IF v_existing.status='open' AND v_existing.deleted_at IS NULL THEN
      RETURN row_to_json(v_existing)::jsonb;
    END IF;
    RAISE EXCEPTION 'El turno % ya existe y está %; no se puede reabrir automáticamente',
      p_session_id,v_existing.status USING ERRCODE='P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cash_sessions
    WHERE branch_id=p_branch_id AND status='open' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Ya existe un turno abierto para la sucursal %',p_branch_id USING ERRCODE='23505';
  END IF;

  INSERT INTO public.cash_sessions(
    id,user_id,worker_name,branch_id,opened_at,opening_balance,
    opening_amount,status,working_employee_ids,notes,created_at
  )
  VALUES(
    p_session_id,p_user_id,p_worker_name,p_branch_id,p_opened_at,
    p_opening_amount,p_opening_amount,'open',p_working_employee_ids,p_notes,NOW()
  )
  RETURNING row_to_json(public.cash_sessions.*)::jsonb INTO v_result;

  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,new_data)
  VALUES(p_user_id,'OPEN_SESSION','cash_session',p_session_id,v_result);

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_cash_session_v2(
  p_session_id text,
  p_user_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_session public.cash_sessions%rowtype;
  v_actor public.users%rowtype;
  v_tx record;
  v_voided integer:=0;
  v_reason text:=COALESCE(NULLIF(trim(p_reason),''),'Cancelación de turno');
BEGIN
  SELECT * INTO v_session FROM public.cash_sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno % no encontrado',p_session_id USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_actor FROM public.users WHERE id=p_user_id LIMIT 1;
  IF NOT FOUND OR v_actor.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'El usuario que intenta cancelar el turno no está activo' USING ERRCODE='42501';
  END IF;

  IF v_actor.role IS DISTINCT FROM 'admin'
     AND v_session.user_id IS DISTINCT FROM p_user_id
     AND NOT (p_user_id = ANY(COALESCE(v_session.working_employee_ids, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'No tienes autorización para cancelar este turno' USING ERRCODE='42501';
  END IF;

  IF v_session.status='cancelled' THEN
    RETURN jsonb_build_object('success',true,'session_id',p_session_id,'already_cancelled',true);
  END IF;
  IF v_session.status='closed' THEN
    RAISE EXCEPTION 'No se puede cancelar un turno ya cerrado' USING ERRCODE='P0001';
  END IF;

  FOR v_tx IN
    SELECT id FROM public.transactions
    WHERE session_id=p_session_id AND deleted_at IS NULL
    ORDER BY created_at,id
  LOOP
    PERFORM public.void_pos_transaction_v2(v_tx.id,COALESCE(p_user_id,'system'),v_reason);
    v_voided:=v_voided+1;
  END LOOP;

  UPDATE public.cash_sessions
  SET status='cancelled',
      closed_at=COALESCE(closed_at,now()),
      delete_reason=v_reason,
      deleted_at=NULL,
      deleted_by=NULL,
      notes=TRIM(COALESCE(notes,'')||' __CANCELLED__:turno_cancelado'),
      updated_at=now()
  WHERE id=p_session_id;

  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,meta)
  VALUES(
    COALESCE(p_user_id,'system'),'CANCEL_SESSION','cash_session',p_session_id,
    jsonb_build_object('reason',v_reason,'transactions_voided',v_voided)
  );

  RETURN jsonb_build_object('success',true,'session_id',p_session_id,'transactions_voided',v_voided);
END;
$function$;

ALTER TABLE public.inventory_repair_backup_20260926 ENABLE ROW LEVEL SECURITY;

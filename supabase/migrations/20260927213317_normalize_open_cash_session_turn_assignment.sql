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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_existing public.cash_sessions%rowtype;
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
    RAISE EXCEPTION 'Ya existe un turno abierto para la sucursal %',p_branch_id
      USING ERRCODE='23505';
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
$$;

NOTIFY pgrst, 'reload schema';
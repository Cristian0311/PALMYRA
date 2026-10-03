ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS turn_number integer;

DO $$
DECLARE
  v_last integer;
  v_count integer;
  v_start integer;
BEGIN
  SELECT COALESCE(last_turn_number, 0) INTO v_last
  FROM public.settings
  WHERE id = 'global'
  FOR UPDATE;

  SELECT count(*) INTO v_count
  FROM public.cash_sessions
  WHERE turn_number IS NULL;

  IF v_count > 0 THEN
    v_start := GREATEST(1, v_last - v_count + 1);
    WITH numbered AS (
      SELECT id,
             v_start + row_number() OVER (ORDER BY opened_at, created_at, id) - 1 AS n
      FROM public.cash_sessions
      WHERE turn_number IS NULL
    )
    UPDATE public.cash_sessions s
       SET turn_number = numbered.n
      FROM numbered
     WHERE s.id = numbered.id;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_turn_number_key
  ON public.cash_sessions(turn_number)
  WHERE turn_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_cash_session_turn_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next integer;
BEGIN
  IF NEW.turn_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.settings
     SET last_turn_number = COALESCE(last_turn_number, 0) + 1
   WHERE id = 'global'
   RETURNING last_turn_number INTO v_next;

  IF v_next IS NULL THEN
    INSERT INTO public.settings(id, last_turn_number)
    VALUES ('global', 1)
    ON CONFLICT (id) DO UPDATE
      SET last_turn_number = COALESCE(public.settings.last_turn_number, 0) + 1
    RETURNING last_turn_number INTO v_next;
  END IF;

  NEW.turn_number := v_next;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_sessions_assign_turn_number
  ON public.cash_sessions;

CREATE TRIGGER trg_cash_sessions_assign_turn_number
BEFORE INSERT ON public.cash_sessions
FOR EACH ROW
EXECUTE FUNCTION public.assign_cash_session_turn_number();

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

  SELECT * INTO v_existing
  FROM public.cash_sessions
  WHERE id=p_session_id
  FOR UPDATE;

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
    SELECT 1
    FROM public.cash_sessions
    WHERE branch_id=p_branch_id
      AND status='open'
      AND deleted_at IS NULL
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
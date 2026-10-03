-- Keep cash-session turn numbers strictly consecutive among non-deleted sessions.
-- This migration also serializes new turn allocation with resequencing so an open
-- and a deletion cannot assign colliding or stale sequence values concurrently.

CREATE OR REPLACE FUNCTION public.assign_cash_session_turn_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_next integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('omnisync_cash_turn_sequence'));
  NEW.turn_number := NULL;

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
$function$;

CREATE OR REPLACE FUNCTION public.resequence_cash_session_turns()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('omnisync_cash_turn_sequence'));

  UPDATE public.cash_sessions
     SET turn_number = NULL
   WHERE deleted_at IS NOT NULL
     AND turn_number IS NOT NULL;

  WITH ordered AS (
    SELECT id,
           ROW_NUMBER() OVER (
             ORDER BY opened_at ASC NULLS LAST,
                      created_at ASC NULLS LAST,
                      id ASC
           ) AS rn
    FROM public.cash_sessions
    WHERE deleted_at IS NULL
  )
  UPDATE public.cash_sessions c
     SET turn_number = -ordered.rn::integer
    FROM ordered
   WHERE c.id = ordered.id;

  UPDATE public.cash_sessions
     SET turn_number = -turn_number
   WHERE deleted_at IS NULL
     AND turn_number < 0;

  SELECT COUNT(*) INTO v_count
    FROM public.cash_sessions
   WHERE deleted_at IS NULL;

  UPDATE public.settings
     SET last_turn_number = v_count
   WHERE id = 'global';

  IF NOT FOUND THEN
    INSERT INTO public.settings(id, last_turn_number)
    VALUES ('global', v_count)
    ON CONFLICT (id) DO UPDATE
      SET last_turn_number = EXCLUDED.last_turn_number;
  END IF;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resequence_cash_session_turns_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.resequence_cash_session_turns();
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cash_sessions_normalize_turn_after_soft_delete ON public.cash_sessions;
CREATE TRIGGER trg_cash_sessions_normalize_turn_after_soft_delete
AFTER UPDATE OF deleted_at ON public.cash_sessions
FOR EACH STATEMENT
EXECUTE FUNCTION public.resequence_cash_session_turns_trigger();

DROP TRIGGER IF EXISTS trg_cash_sessions_normalize_turn_after_delete ON public.cash_sessions;
CREATE TRIGGER trg_cash_sessions_normalize_turn_after_delete
AFTER DELETE ON public.cash_sessions
FOR EACH STATEMENT
EXECUTE FUNCTION public.resequence_cash_session_turns_trigger();

REVOKE ALL ON FUNCTION public.resequence_cash_session_turns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resequence_cash_session_turns() FROM anon;
REVOKE ALL ON FUNCTION public.resequence_cash_session_turns() FROM authenticated;

SELECT public.resequence_cash_session_turns();

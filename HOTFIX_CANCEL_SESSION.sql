-- Cancelación de turno: operación atómica y auditable.
-- El turno no se elimina; queda con status='cancelled'.
-- Las ventas del turno se anulan mediante void_pos_transaction_v2.

-- Asegurar columnas si se ejecuta en Supabase
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS delete_reason TEXT;

create or replace function public.cancel_cash_session_v2(
  p_session_id text,
  p_user_id text,
  p_reason text
)
returns jsonb
language plpgsql
as $function$
declare
  v_session public.cash_sessions%rowtype;
  v_tx record;
  v_voided integer := 0;
begin
  select * into v_session
  from public.cash_sessions
  where id = p_session_id
  for update;

  if not found then raise exception 'Turno % no encontrado', p_session_id; end if;
  if v_session.status = 'cancelled' then
    return jsonb_build_object('success', true, 'session_id', p_session_id, 'already_cancelled', true);
  end if;
  if v_session.status <> 'open' then
    raise exception 'El turno % no está abierto y no puede cancelarse', p_session_id;
  end if;

  for v_tx in
    select id from public.transactions
    where session_id = p_session_id and deleted_at is null
    order by created_at, id
  loop
    perform public.void_pos_transaction_v2(
      v_tx.id, coalesce(p_user_id, 'system'), coalesce(nullif(p_reason,''), 'Cancelación de turno')
    );
    v_voided := v_voided + 1;
  end loop;

  update public.cash_sessions
  set status='cancelled',
      closed_at=coalesce(closed_at, now()),
      delete_reason=coalesce(nullif(p_reason,''), 'Cancelación de turno'),
      deleted_at=null,
      deleted_by=null,
      notes=trim(coalesce(notes,'') || ' __CANCELLED__:turno_cancelado')
  where id=p_session_id;

  insert into public.audit_log(user_id, action, entity_type, entity_id, meta)
  values (coalesce(p_user_id,'system'),'CANCEL_SESSION','cash_session',p_session_id,
          jsonb_build_object('reason',coalesce(nullif(p_reason,''),'Cancelación de turno'), 'transactions_voided',v_voided));

  return jsonb_build_object('success',true,'session_id',p_session_id,'transactions_voided',v_voided);
end
$function$;

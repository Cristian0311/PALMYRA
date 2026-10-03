-- Prevent bank receipts linked to POS sales from becoming orphaned.
-- A payment_received linked to a transaction is accepted only when that sale
-- exists in Supabase and is still completed.

CREATE OR REPLACE FUNCTION public.process_bank_transaction_v2(
  p_id text,
  p_card_id text,
  p_type text,
  p_amount numeric,
  p_date timestamp with time zone,
  p_reference text,
  p_description text,
  p_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_card public.bank_cards%ROWTYPE;
  v_existing public.bank_transactions%ROWTYPE;
  v_sale public.transactions%ROWTYPE;
  v_new_balance numeric;
  v_user_id text;
BEGIN
  IF NULLIF(btrim(p_id),'') IS NULL THEN
    RAISE EXCEPTION 'ID de movimiento requerido' USING ERRCODE='P0001';
  END IF;
  IF p_card_id IS NULL THEN
    RAISE EXCEPTION 'Cuenta bancaria requerida' USING ERRCODE='P0001';
  END IF;
  IF COALESCE(p_amount,0)<=0 THEN
    RAISE EXCEPTION 'El importe debe ser mayor que 0' USING ERRCODE='P0001';
  END IF;
  IF p_type NOT IN ('deposit','withdrawal','payment_received','supplier_payment') THEN
    RAISE EXCEPTION 'Tipo de movimiento bancario no soportado: %',p_type USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_existing
  FROM public.bank_transactions
  WHERE id=p_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success',true,'already_existed',true,'transaction_id',v_existing.id,
      'card_id',v_existing.card_id,
      'balance',(SELECT balance FROM public.bank_cards WHERE id=v_existing.card_id)
    );
  END IF;

  IF p_type='payment_received' AND p_transaction_id IS NOT NULL THEN
    SELECT * INTO v_sale
    FROM public.transactions
    WHERE id=p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La venta asociada % todavía no existe en Supabase',p_transaction_id
        USING ERRCODE='P0001';
    END IF;

    IF v_sale.deleted_at IS NOT NULL OR v_sale.status <> 'completed' THEN
      RAISE EXCEPTION 'La venta asociada % no está disponible para recibir un cobro bancario',p_transaction_id
        USING ERRCODE='P0001';
    END IF;
  ELSIF p_transaction_id IS NOT NULL THEN
    SELECT * INTO v_sale
    FROM public.transactions
    WHERE id=p_transaction_id
    FOR UPDATE;
    IF FOUND AND (v_sale.deleted_at IS NOT NULL OR v_sale.status='refunded') THEN
      RAISE EXCEPTION 'No se puede crear un movimiento bancario para la venta anulada %',p_transaction_id
        USING ERRCODE='P0001';
    END IF;
  END IF;

  SELECT * INTO v_card
  FROM public.bank_cards
  WHERE id=p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cuenta bancaria no existe' USING ERRCODE='P0001';
  END IF;

  IF p_reference IS NOT NULL AND btrim(p_reference)<>'' THEN
    SELECT * INTO v_existing
    FROM public.bank_transactions
    WHERE card_id=p_card_id AND reference=p_reference
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success',true,'already_existed',true,'transaction_id',v_existing.id,
        'card_id',v_existing.card_id,'balance',v_card.balance
      );
    END IF;
  END IF;

  IF p_type IN ('withdrawal','supplier_payment') THEN
    IF v_card.balance < p_amount THEN
      RAISE EXCEPTION 'Saldo insuficiente en la cuenta: disponible %, requerido %',
        v_card.balance,p_amount USING ERRCODE='P0001';
    END IF;
    v_new_balance := v_card.balance-p_amount;
  ELSE
    v_new_balance := v_card.balance+p_amount;
  END IF;

  UPDATE public.bank_cards SET balance=v_new_balance WHERE id=p_card_id;

  INSERT INTO public.bank_transactions(
    id,card_id,type,amount,date,reference,description,transaction_id
  )
  VALUES(
    p_id,p_card_id,p_type,p_amount,COALESCE(p_date,NOW()),
    NULLIF(btrim(p_reference),''),
    COALESCE(p_description,''),
    NULLIF(btrim(p_transaction_id),'')
  );

  v_user_id := NULLIF(current_setting('request.jwt.claim.sub', true),'');
  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,meta)
  VALUES(
    v_user_id,'BANK_TRANSACTION_CREATE','bank_transaction',p_id,
    jsonb_build_object(
      'card_id',p_card_id,'type',p_type,'amount',p_amount,
      'reference',NULLIF(btrim(p_reference),''),
      'transaction_id',NULLIF(btrim(p_transaction_id),''),
      'balance_after',v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success',true,'transaction_id',p_id,'card_id',p_card_id,'balance',v_new_balance
  );
END
$function$;

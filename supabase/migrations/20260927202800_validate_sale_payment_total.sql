-- Permite sincronizar una venta creada offline antes del cierre de su turno,
-- aunque el dispositivo llegue después. Las ventas posteriores al cierre siguen bloqueadas.
CREATE OR REPLACE FUNCTION public.process_pos_transaction_v2(p_id text, p_branch_id text, p_user_id text, p_date timestamp with time zone, p_total numeric, p_tax numeric, p_discount numeric, p_items jsonb, p_payments jsonb, p_payment_method text, p_session_id text, p_customer_id text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req RECORD;
  v_inv inventory%ROWTYPE;
  v_existing transactions%ROWTYPE;
  v_payment_count integer;
  v_persisted_items jsonb;
  v_session_status text;
  v_session_closed_at timestamptz;
  v_late_sale boolean := false;
BEGIN
  IF NULLIF(btrim(p_id),'') IS NULL THEN RAISE EXCEPTION 'ID de transacción requerido' USING ERRCODE='P0001'; END IF;
  IF NULLIF(btrim(p_branch_id),'') IS NULL THEN RAISE EXCEPTION 'Sucursal requerida' USING ERRCODE='P0001'; END IF;
  IF NULLIF(btrim(p_user_id),'') IS NULL THEN RAISE EXCEPTION 'Usuario requerido' USING ERRCODE='P0001'; END IF;
  IF COALESCE(p_total,0) < 0 OR COALESCE(p_tax,0) < 0 OR COALESCE(p_discount,0) < 0 THEN RAISE EXCEPTION 'Importes de venta inválidos' USING ERRCODE='P0001'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'La venta debe contener al menos un producto' USING ERRCODE='P0001'; END IF;
  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' THEN RAISE EXCEPTION 'Los pagos de la venta son inválidos' USING ERRCODE='P0001'; END IF;

  SELECT count(*) INTO v_payment_count
  FROM jsonb_to_recordset(p_payments) x(amount numeric,exchangeRate numeric,method text,currencyCode text)
  WHERE COALESCE(x.amount,0) > 0;
  IF v_payment_count=0 THEN RAISE EXCEPTION 'La venta debe tener al menos un pago' USING ERRCODE='P0001'; END IF;

  -- El total pagado se expresa en moneda base usando la tasa capturada en cada pago.
  -- Permitimos sobrepago porque el POS calcula vuelto, pero nunca pago insuficiente.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payments) x(payment)
    WHERE COALESCE((x.payment->>'amount')::numeric,0) > 0
      AND (
        COALESCE(NULLIF(x.payment->>'exchangeRate','')::numeric,
                 NULLIF(x.payment->>'exchange_rate','')::numeric,0) <= 0
        OR COALESCE(x.payment->>'method','') NOT IN ('cash','transfer')
        OR COALESCE(NULLIF(x.payment->>'currencyCode',''), x.payment->>'currency_code','') NOT IN ('CUP','USD','EUR','MN')
      )
  ) THEN
    RAISE EXCEPTION 'Hay un pago con moneda, método o tasa inválidos' USING ERRCODE='P0001';
  END IF;

  IF (
    SELECT COALESCE(SUM(
      COALESCE((x.payment->>'amount')::numeric,0) *
      COALESCE(
        NULLIF(x.payment->>'exchangeRate','')::numeric,
        NULLIF(x.payment->>'exchange_rate','')::numeric,
        1
      )
    ),0)
    FROM jsonb_array_elements(p_payments) x(payment)
    WHERE COALESCE((x.payment->>'amount')::numeric,0) > 0
  ) + 0.009 < COALESCE(p_total,0) THEN
    RAISE EXCEPTION 'Pagos insuficientes: el total cobrado no cubre la venta' USING ERRCODE='P0001';
  END IF;

  -- El importe de la venta debe cuadrar con sus líneas + impuesto - descuento.
  -- Esto impide que un cliente/aplicación mal sincronizado cree una venta con
  -- total distinto a la mercancía realmente registrada.
  IF abs((
    SELECT COALESCE(SUM(
      CASE
        WHEN jsonb_typeof(x.item->'total')='number' THEN COALESCE((x.item->>'total')::numeric,0)
        WHEN jsonb_typeof(x.item->'price')='number' THEN
          COALESCE((x.item->>'price')::numeric,0) * COALESCE((x.item->>'quantity')::numeric,0)
        ELSE 0
      END
    ),0)
    FROM jsonb_array_elements(p_items) x(item)
  ) + COALESCE(p_tax,0) - COALESCE(p_discount,0) - COALESCE(p_total,0)) > 0.009 THEN
    RAISE EXCEPTION 'El total de la venta no coincide con sus líneas, impuesto y descuento' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_existing FROM transactions WHERE id=p_id OR idempotency_key=p_id LIMIT 1;
  IF FOUND THEN
    IF v_existing.branch_id IS NOT DISTINCT FROM p_branch_id
       AND v_existing.user_id IS NOT DISTINCT FROM p_user_id
       AND v_existing.total IS NOT DISTINCT FROM p_total
       AND v_existing.tax IS NOT DISTINCT FROM p_tax
       AND v_existing.discount IS NOT DISTINCT FROM p_discount
       AND v_existing.session_id IS NOT DISTINCT FROM p_session_id
       AND COALESCE(v_existing.payment_method,'cash') IS NOT DISTINCT FROM COALESCE(p_payment_method,'cash')
       AND v_existing.status='completed' THEN
      RETURN jsonb_build_object('success',true,'id',v_existing.id,'already_existed',true);
    END IF;
    RAISE EXCEPTION 'Conflicto de idempotencia: el ID % ya pertenece a otra operación',p_id USING ERRCODE='P0001';
  END IF;

  IF p_session_id IS NOT NULL THEN
    SELECT status, closed_at
      INTO v_session_status, v_session_closed_at
    FROM cash_sessions
    WHERE id=p_session_id AND branch_id=p_branch_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El turno % no existe o no pertenece a la sucursal %',p_session_id,p_branch_id USING ERRCODE='P0001';
    END IF;

    IF v_session_status='cancelled' THEN
      RAISE EXCEPTION 'El turno % fue cancelado; no se acepta una venta pendiente de ese turno',p_session_id USING ERRCODE='P0001';
    END IF;

    IF v_session_status='closed' THEN
      IF v_session_closed_at IS NULL OR p_date > v_session_closed_at THEN
        RAISE EXCEPTION 'El turno % ya estaba cerrado cuando ocurrió esta operación',p_session_id USING ERRCODE='P0001';
      END IF;
      v_late_sale := true;
    END IF;
  END IF;

  FOR v_req IN
    WITH raw AS (
      SELECT x.product_id,COALESCE(x.variant_label,'') variant_label,x.quantity required
      FROM jsonb_to_recordset(p_items) x(product_id text,quantity integer,variant_label text,is_kit boolean,kit_components jsonb)
      WHERE COALESCE(x.is_kit,false)=false
      UNION ALL
      SELECT c.product_id,'',c.quantity*x.quantity
      FROM jsonb_to_recordset(p_items) x(product_id text,quantity integer,variant_label text,is_kit boolean,kit_components jsonb)
      CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(x.kit_components,'[]'::jsonb)) c(product_id text,quantity integer)
      WHERE COALESCE(x.is_kit,false)=true
    )
    SELECT product_id,variant_label,SUM(required)::integer required
    FROM raw GROUP BY product_id,variant_label ORDER BY product_id,variant_label
  LOOP
    IF NULLIF(btrim(v_req.product_id),'') IS NULL OR v_req.required IS NULL OR v_req.required<=0 THEN
      RAISE EXCEPTION 'Producto o cantidad inválida en la venta' USING ERRCODE='P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('inventory:'||v_req.product_id||':'||p_branch_id||':'||v_req.variant_label));
    SELECT * INTO v_inv FROM inventory
    WHERE product_id=v_req.product_id AND branch_id=p_branch_id AND COALESCE(variant_label,'')=v_req.variant_label
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No existe inventario para producto %',v_req.product_id USING ERRCODE='P0001'; END IF;
    IF v_inv.quantity<v_req.required THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %: disponible %, requerido %',v_req.product_id,v_inv.quantity,v_req.required USING ERRCODE='P0001';
    END IF;
    UPDATE inventory SET quantity=quantity-v_req.required WHERE id=v_inv.id;
  END LOOP;

  SELECT COALESCE(
    jsonb_agg(
      x.item || jsonb_build_object(
        'id', COALESCE(NULLIF(x.item->>'id',''), p_id||':'||x.ord::text),
        'product',
          CASE
            WHEN jsonb_typeof(x.item->'product')='object' THEN x.item->'product'
            WHEN jsonb_typeof(x.item->'product_snapshot')='object' THEN x.item->'product_snapshot'
            WHEN p.id IS NOT NULL THEN jsonb_build_object(
              'id', p.id, 'name', p.name, 'sku', COALESCE(p.sku,''), 'barcode', COALESCE(p.barcode,''),
              'costPrice', COALESCE(p.cost_price,0), 'price', COALESCE(p.price,0), 'margin', COALESCE(p.margin,0),
              'categoryId', COALESCE(p.category_id,''), 'color', COALESCE(p.color,''), 'commissionValue', COALESCE(p.commission_value,0),
              'unit', COALESCE(p.unit,'unidad'), 'status', COALESCE(p.status,'active'), 'minStockAlert', COALESCE(p.min_stock_alert,0),
              'hasSerial', COALESCE(p.has_serial,false), 'warrantyDays', COALESCE(p.warranty_days,0), 'isKit', COALESCE(p.is_kit,false),
              'kitItems', COALESCE(p.kit_items,'[]'::jsonb), 'kitComponents', COALESCE(p.kit_items,'[]'::jsonb),
              'deviceColor', COALESCE(p.device_color,''), 'availableSizes', COALESCE(p.available_sizes,'[]'::jsonb),
              'availableColors', COALESCE(p.available_colors,'[]'::jsonb)
            )
            ELSE NULL
          END,
        'price',
          CASE
            WHEN jsonb_typeof(x.item->'price')='number' THEN x.item->'price'
            WHEN jsonb_typeof(x.item->'product_snapshot')='object' AND jsonb_typeof(x.item->'product_snapshot'->'price')='number' THEN x.item->'product_snapshot'->'price'
            WHEN p.id IS NOT NULL THEN to_jsonb(COALESCE(p.price,0))
            ELSE '0'::jsonb
          END,
        'total',
          CASE
            WHEN jsonb_typeof(x.item->'total')='number' THEN x.item->'total'
            ELSE to_jsonb(
              (CASE
                WHEN jsonb_typeof(x.item->'price')='number' THEN COALESCE((x.item->>'price')::numeric,0)
                WHEN jsonb_typeof(x.item->'product_snapshot')='object' AND jsonb_typeof(x.item->'product_snapshot'->'price')='number' THEN COALESCE((x.item->'product_snapshot'->>'price')::numeric,0)
                WHEN p.id IS NOT NULL THEN COALESCE(p.price,0)
                ELSE 0 END)
              * CASE WHEN jsonb_typeof(x.item->'quantity')='number' THEN COALESCE((x.item->>'quantity')::numeric,0) ELSE 0 END
            )
          END,
        'variantLabel', COALESCE(x.item->>'variantLabel',x.item->>'variant_label','')
      ) ORDER BY x.ord
    ), '[]'::jsonb
  ) INTO v_persisted_items
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS x(item,ord)
  LEFT JOIN products p ON p.id=COALESCE(x.item->>'product_id',x.item->'product'->>'id');

  INSERT INTO transactions(
    id,idempotency_key,branch_id,user_id,date,total,tax,discount,items,payments,
    payment_method,session_id,customer_id,notes,status,created_at
  )
  VALUES(
    p_id,p_id,p_branch_id,p_user_id,p_date,p_total,p_tax,p_discount,v_persisted_items,p_payments,
    p_payment_method,p_session_id,p_customer_id,
    CASE WHEN v_late_sale THEN COALESCE(NULLIF(p_notes,'')||' | ','') || 'LATE_TRANSACTION_BEFORE_SESSION_CLOSE' ELSE p_notes END,
    'completed',NOW()
  );

  INSERT INTO inventory_movements(product_id,branch_id,variant_label,quantity_delta,movement_type,reference_id,user_id,metadata)
  SELECT
    r.product_id,p_branch_id,r.variant_label,-r.required,
    CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_items) x(product_id text,quantity integer,variant_label text,is_kit boolean,kit_components jsonb)
      WHERE x.is_kit=true
        AND EXISTS (SELECT 1 FROM jsonb_to_recordset(COALESCE(x.kit_components,'[]'::jsonb)) c(product_id text,quantity integer) WHERE c.product_id=r.product_id)
    ) THEN 'KIT_CONSUMPTION' ELSE 'SALE' END,
    p_id,p_user_id,
    CASE WHEN v_late_sale THEN jsonb_build_object('late_sale_before_close',true,'session_closed_at',v_session_closed_at) ELSE NULL END
  FROM (
    SELECT product_id,variant_label,SUM(required)::integer required
    FROM (
      SELECT x.product_id,COALESCE(x.variant_label,'') variant_label,x.quantity required
      FROM jsonb_to_recordset(p_items) x(product_id text,quantity integer,variant_label text,is_kit boolean,kit_components jsonb)
      WHERE COALESCE(x.is_kit,false)=false
      UNION ALL
      SELECT c.product_id,'',c.quantity*x.quantity
      FROM jsonb_to_recordset(p_items) x(product_id text,quantity integer,variant_label text,is_kit boolean,kit_components jsonb)
      CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(x.kit_components,'[]'::jsonb)) c(product_id text,quantity integer)
      WHERE COALESCE(x.is_kit,false)=true
    ) raw GROUP BY product_id,variant_label
  ) r;

  INSERT INTO audit_log(user_id,action,entity_type,entity_id,meta)
  VALUES(
    p_user_id,
    CASE WHEN v_late_sale THEN 'PROCESS_LATE_TRANSACTION' ELSE 'PROCESS_TRANSACTION' END,
    'transaction',p_id,
    jsonb_build_object('total',p_total,'session_id',p_session_id,'late_before_close',v_late_sale)
  );

  RETURN jsonb_build_object('success',true,'id',p_id,'late_before_close',v_late_sale);
END
$function$;

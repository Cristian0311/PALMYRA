-- OmniSync POS: hotfix de integridad de ventas offline/multi-POS.
-- Aplicar SOLO esta función en la base Supabase REAL después de verificar backup.
-- No elimina ni modifica datos existentes.

CREATE OR REPLACE FUNCTION process_pos_transaction_v2(
  p_id TEXT, p_branch_id TEXT, p_user_id TEXT, p_date TIMESTAMPTZ,
  p_total NUMERIC, p_tax NUMERIC, p_discount NUMERIC, p_items JSONB,
  p_payments JSONB, p_payment_method TEXT, p_session_id TEXT,
  p_customer_id TEXT, p_notes TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_req RECORD; v_inv inventory%ROWTYPE;
BEGIN
  IF EXISTS (SELECT 1 FROM transactions WHERE id=p_id) THEN
    RETURN jsonb_build_object('success',true,'id',p_id,'already_existed',true);
  END IF;
  IF p_session_id IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM cash_sessions WHERE id=p_session_id AND branch_id=p_branch_id AND status='open' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'El turno % no está abierto o no pertenece a la sucursal %',p_session_id,p_branch_id;
  END IF;

  -- Primero agregamos toda la necesidad de stock. Esto evita que dos líneas del
  -- mismo SKU se validen por separado y, al ordenar los locks, reduce deadlocks
  -- cuando dos POS venden varios productos en distinto orden.
  FOR v_req IN
    WITH raw AS (
      SELECT x.product_id, COALESCE(x.variant_label,'') AS variant_label, x.quantity AS required
      FROM jsonb_to_recordset(p_items)
        AS x(product_id TEXT, quantity INTEGER, variant_label TEXT, is_kit BOOLEAN, kit_components JSONB)
      WHERE COALESCE(x.is_kit,false)=false
      UNION ALL
      SELECT c.product_id, '' AS variant_label, (c.quantity * x.quantity) AS required
      FROM jsonb_to_recordset(p_items)
        AS x(product_id TEXT, quantity INTEGER, variant_label TEXT, is_kit BOOLEAN, kit_components JSONB)
      CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(x.kit_components,'[]'::jsonb))
        AS c(product_id TEXT, quantity INTEGER)
      WHERE COALESCE(x.is_kit,false)=true
    )
    SELECT product_id, variant_label, SUM(required)::INTEGER AS required
    FROM raw
    GROUP BY product_id, variant_label
    ORDER BY product_id, variant_label
  LOOP
    IF v_req.required IS NULL OR v_req.required <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para producto %',v_req.product_id;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('inventory:'||v_req.product_id||':'||p_branch_id||':'||v_req.variant_label));
    SELECT * INTO v_inv FROM inventory
      WHERE product_id=v_req.product_id AND branch_id=p_branch_id
        AND COALESCE(variant_label,'')=v_req.variant_label FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No existe inventario para producto %',v_req.product_id; END IF;
    IF v_inv.quantity < v_req.required THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %: disponible %, requerido %',v_req.product_id,v_inv.quantity,v_req.required;
    END IF;
    UPDATE inventory SET quantity=quantity-v_req.required WHERE id=v_inv.id;
  END LOOP;

  INSERT INTO transactions(id,branch_id,user_id,date,total,tax,discount,items,payments,payment_method,session_id,customer_id,notes,status,created_at)
  VALUES(p_id,p_branch_id,p_user_id,p_date,p_total,p_tax,p_discount,p_items,p_payments,p_payment_method,p_session_id,p_customer_id,p_notes,'completed',NOW());

  INSERT INTO inventory_movements(product_id,branch_id,variant_label,quantity_delta,movement_type,reference_id,user_id,metadata)
  SELECT r.product_id,p_branch_id,r.variant_label,-r.required,
    CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_items) x(product_id TEXT, quantity INTEGER, variant_label TEXT, is_kit BOOLEAN, kit_components JSONB)
      WHERE x.is_kit=true AND EXISTS (
        SELECT 1 FROM jsonb_to_recordset(COALESCE(x.kit_components,'[]'::jsonb)) c(product_id TEXT,quantity INTEGER) WHERE c.product_id=r.product_id
      )
    ) THEN 'KIT_CONSUMPTION' ELSE 'SALE' END,
    p_id,p_user_id,NULL
  FROM (
    WITH raw AS (
      SELECT x.product_id, COALESCE(x.variant_label,'') AS variant_label, x.quantity AS required
      FROM jsonb_to_recordset(p_items) x(product_id TEXT,quantity INTEGER,variant_label TEXT,is_kit BOOLEAN,kit_components JSONB)
      WHERE COALESCE(x.is_kit,false)=false
      UNION ALL
      SELECT c.product_id,'',(c.quantity*x.quantity)
      FROM jsonb_to_recordset(p_items) x(product_id TEXT,quantity INTEGER,variant_label TEXT,is_kit BOOLEAN,kit_components JSONB)
      CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(x.kit_components,'[]'::jsonb)) c(product_id TEXT,quantity INTEGER)
      WHERE COALESCE(x.is_kit,false)=true
    ) SELECT product_id,variant_label,SUM(required)::INTEGER required FROM raw GROUP BY product_id,variant_label
  ) r;

  INSERT INTO audit_log(user_id,action,entity_type,entity_id,meta)
  VALUES(p_user_id,'PROCESS_TRANSACTION','transaction',p_id,jsonb_build_object('total',p_total,'session_id',p_session_id));
  RETURN jsonb_build_object('success',true,'id',p_id);
END $$;

-- --------------------------------------------------------------------------
-- Inventario offline-first: nunca sincronizar un "stock absoluto" sin contexto.
-- Los POS envían operaciones idempotentes (delta) o una reconciliación protegida
-- por el valor que el empleado vio antes de hacer el conteo.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_inventory_adjustment_v2(
  p_operation_id TEXT, p_product_id TEXT, p_branch_id TEXT, p_variant_label TEXT,
  p_delta INTEGER, p_min_quantity INTEGER, p_user_id TEXT, p_movement_type TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_inv inventory%ROWTYPE; v_variant TEXT := COALESCE(p_variant_label,'');
BEGIN
  IF EXISTS (SELECT 1 FROM inventory_movements WHERE reference_id=p_operation_id) THEN
    RETURN jsonb_build_object('success',true,'already_applied',true,'operation_id',p_operation_id);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('inventory:'||p_product_id||':'||p_branch_id||':'||v_variant));
  SELECT * INTO v_inv FROM inventory
    WHERE product_id=p_product_id AND branch_id=p_branch_id AND COALESCE(variant_label,'')=v_variant FOR UPDATE;
  IF NOT FOUND THEN
    IF p_delta < 0 THEN RAISE EXCEPTION 'No existe inventario para producto %',p_product_id; END IF;
    INSERT INTO inventory(id,product_id,branch_id,variant_label,quantity,min_quantity)
    VALUES(gen_random_uuid()::text,p_product_id,p_branch_id,v_variant,p_delta,COALESCE(p_min_quantity,5))
    RETURNING * INTO v_inv;
  ELSE
    IF v_inv.quantity + p_delta < 0 THEN
      RAISE EXCEPTION 'Ajuste dejaría inventario negativo para producto %',p_product_id;
    END IF;
    UPDATE inventory SET quantity=v_inv.quantity+p_delta,min_quantity=COALESCE(p_min_quantity,v_inv.min_quantity)
    WHERE id=v_inv.id RETURNING * INTO v_inv;
  END IF;
  INSERT INTO inventory_movements(product_id,branch_id,variant_label,quantity_delta,movement_type,reference_id,user_id)
  VALUES(p_product_id,p_branch_id,v_variant,p_delta,COALESCE(NULLIF(p_movement_type,''),'ADJUSTMENT'),p_operation_id,p_user_id);
  RETURN jsonb_build_object('success',true,'quantity',v_inv.quantity,'operation_id',p_operation_id);
END $$;

CREATE OR REPLACE FUNCTION reconcile_inventory_v2(
  p_operation_id TEXT, p_product_id TEXT, p_branch_id TEXT, p_variant_label TEXT,
  p_expected_quantity INTEGER, p_new_quantity INTEGER, p_min_quantity INTEGER, p_user_id TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_inv inventory%ROWTYPE; v_variant TEXT := COALESCE(p_variant_label,''); v_delta INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM inventory_movements WHERE reference_id=p_operation_id) THEN
    RETURN jsonb_build_object('success',true,'already_applied',true,'operation_id',p_operation_id);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('inventory:'||p_product_id||':'||p_branch_id||':'||v_variant));
  SELECT * INTO v_inv FROM inventory
    WHERE product_id=p_product_id AND branch_id=p_branch_id AND COALESCE(variant_label,'')=v_variant FOR UPDATE;
  IF NOT FOUND THEN
    IF COALESCE(p_expected_quantity,0) <> 0 THEN
      RETURN jsonb_build_object('success',false,'conflict',true,'message','El inventario ya no coincide con el valor visto offline.');
    END IF;
    INSERT INTO inventory(id,product_id,branch_id,variant_label,quantity,min_quantity)
    VALUES(gen_random_uuid()::text,p_product_id,p_branch_id,v_variant,GREATEST(0,p_new_quantity),COALESCE(p_min_quantity,5))
    RETURNING * INTO v_inv;
    v_delta := GREATEST(0,p_new_quantity);
  ELSE
    IF v_inv.quantity <> COALESCE(p_expected_quantity,0) THEN
      RETURN jsonb_build_object('success',false,'conflict',true,'message',format('Conflicto: servidor tiene %, dispositivo esperaba %.',v_inv.quantity,p_expected_quantity));
    END IF;
    v_delta := GREATEST(0,p_new_quantity)-v_inv.quantity;
    UPDATE inventory SET quantity=GREATEST(0,p_new_quantity),min_quantity=COALESCE(p_min_quantity,v_inv.min_quantity)
    WHERE id=v_inv.id RETURNING * INTO v_inv;
  END IF;
  IF v_delta <> 0 THEN
    INSERT INTO inventory_movements(product_id,branch_id,variant_label,quantity_delta,movement_type,reference_id,user_id)
    VALUES(p_product_id,p_branch_id,v_variant,v_delta,'RECONCILIATION',p_operation_id,p_user_id);
  END IF;
  RETURN jsonb_build_object('success',true,'quantity',v_inv.quantity,'operation_id',p_operation_id);
END $$;

DO $migration$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'process_inventory_transfer_v2'
  ORDER BY p.oid
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'process_inventory_transfer_v2 no existe';
  END IF;

  IF position('PERFORM public.assert_pos_inventory_operator_access' IN v_def) = 0 THEN
    v_def := replace(
      v_def,
      E'\nbegin\n',
      E'\nbegin\n  PERFORM public.assert_pos_inventory_operator_access(p_user_id,p_from_branch_id);\n'
    );
    EXECUTE v_def;
  END IF;
END $migration$;

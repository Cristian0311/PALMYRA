-- OmniSync data repair plan. Review the six duplicate inventory keys before execution.
-- This script consolidates duplicate rows by summing quantities and keeping the oldest id.
-- It intentionally does not run automatically from the application.

BEGIN;
DO $$
DECLARE r RECORD; keep_id TEXT; total_qty INTEGER; max_min INTEGER;
BEGIN
  FOR r IN SELECT product_id, branch_id, COALESCE(variant_label,) variant_label
           FROM inventory GROUP BY 1,2,3 HAVING COUNT(*) > 1 LOOP
    SELECT id INTO keep_id FROM inventory
      WHERE product_id=r.product_id AND branch_id=r.branch_id AND COALESCE(variant_label,)=r.variant_label
      ORDER BY id LIMIT 1;
    SELECT COALESCE(SUM(quantity),0), COALESCE(MAX(min_quantity),5) INTO total_qty,max_min
      FROM inventory
      WHERE product_id=r.product_id AND branch_id=r.branch_id AND COALESCE(variant_label,)=r.variant_label;
    UPDATE inventory SET quantity=GREATEST(0,total_qty), min_quantity=max_min WHERE id=keep_id;
    DELETE FROM inventory
      WHERE product_id=r.product_id AND branch_id=r.branch_id AND COALESCE(variant_label,)=r.variant_label
        AND id<>keep_id;
  END LOOP;
END $$;
COMMIT;

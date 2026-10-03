-- Run this migration on the live Supabase project before deploying the repaired app.
-- It creates the missing inventory movement ledger, backs up duplicate inventory rows,
-- consolidates duplicate identities, and records negative stock for manual review.
-- It does NOT silently zero negative stock.

BEGIN;

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  branch_id text NOT NULL,
  variant_label text NOT NULL DEFAULT '',
  quantity_delta integer NOT NULL,
  movement_type text NOT NULL,
  reference_id text NOT NULL,
  user_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_branch ON public.inventory_movements(product_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON public.inventory_movements(reference_id);

CREATE TABLE IF NOT EXISTS public.inventory_duplicate_repair_backup (
  repair_id uuid NOT NULL DEFAULT gen_random_uuid(), repaired_at timestamptz NOT NULL DEFAULT now(),
  id text, product_id text, branch_id text, variant_label text, quantity integer, min_quantity integer
);
CREATE TABLE IF NOT EXISTS public.inventory_negative_stock_review (
  id text PRIMARY KEY, detected_at timestamptz NOT NULL DEFAULT now(), product_id text NOT NULL,
  branch_id text NOT NULL, variant_label text NOT NULL DEFAULT '', quantity integer NOT NULL,
  min_quantity integer NOT NULL DEFAULT 5, status text NOT NULL DEFAULT 'pending'
);

INSERT INTO public.inventory_negative_stock_review(id, product_id, branch_id, variant_label, quantity, min_quantity)
SELECT i.id, i.product_id, i.branch_id, COALESCE(i.variant_label,''), i.quantity, COALESCE(i.min_quantity,5)
FROM public.inventory i WHERE i.quantity < 0 ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE r record; keep_id text; total_qty integer; max_min integer;
BEGIN
  FOR r IN SELECT product_id, branch_id, COALESCE(variant_label,'') variant_label FROM public.inventory GROUP BY 1,2,3 HAVING COUNT(*)>1 LOOP
    INSERT INTO public.inventory_duplicate_repair_backup(id,product_id,branch_id,variant_label,quantity,min_quantity)
    SELECT id,product_id,branch_id,COALESCE(variant_label,''),quantity,COALESCE(min_quantity,5) FROM public.inventory
    WHERE product_id=r.product_id AND branch_id=r.branch_id AND COALESCE(variant_label,'')=r.variant_label;
    SELECT id INTO keep_id FROM public.inventory WHERE product_id=r.product_id AND branch_id=r.branch_id AND COALESCE(variant_label,'')=r.variant_label ORDER BY id LIMIT 1;
    SELECT COALESCE(SUM(quantity),0),COALESCE(MAX(min_quantity),5) INTO total_qty,max_min FROM public.inventory WHERE product_id=r.product_id AND branch_id=r.branch_id AND COALESCE(variant_label,'')=r.variant_label;
    UPDATE public.inventory SET quantity=total_qty,min_quantity=max_min,variant_label=r.variant_label WHERE id=keep_id;
    DELETE FROM public.inventory WHERE product_id=r.product_id AND branch_id=r.branch_id AND COALESCE(variant_label,'')=r.variant_label AND id<>keep_id;
  END LOOP;
END $$;

UPDATE public.inventory SET variant_label='' WHERE variant_label IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_product_branch_variant_uidx ON public.inventory(product_id, branch_id, COALESCE(variant_label,''));
COMMIT;

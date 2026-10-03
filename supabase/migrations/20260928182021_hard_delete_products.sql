-- Hard delete products while retaining historical records that can outlive the product master row.
-- Current inventory is intentionally removed by the existing CASCADE on inventory.product_id.
CREATE TABLE IF NOT EXISTS public.product_delete_tombstones (
  product_id text PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_delete_tombstones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_delete_tombstones FROM PUBLIC, anon, authenticated;

ALTER TABLE public.inventory_movements ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_audit_items DROP CONSTRAINT IF EXISTS inventory_audit_items_product_id_fkey;
ALTER TABLE public.inventory_audit_items ADD CONSTRAINT inventory_audit_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_transfers DROP CONSTRAINT IF EXISTS inventory_transfers_product_id_fkey;
ALTER TABLE public.inventory_transfers ADD CONSTRAINT inventory_transfers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_product_id_fkey;
ALTER TABLE public.returns ADD CONSTRAINT returns_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.warranties DROP CONSTRAINT IF EXISTS warranties_product_id_fkey;
ALTER TABLE public.warranties ADD CONSTRAINT warranties_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.idn_settlement_prices DROP CONSTRAINT IF EXISTS idn_settlement_prices_product_id_fkey;
ALTER TABLE public.idn_settlement_prices ADD CONSTRAINT idn_settlement_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.guard_deleted_product_upsert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.product_delete_tombstones WHERE product_id = NEW.id) THEN
    RAISE EXCEPTION 'PRODUCT_DELETED: el producto fue eliminado permanentemente' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_deleted_product_upsert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_guard_deleted_product_upsert ON public.products;
CREATE TRIGGER trg_guard_deleted_product_upsert BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.guard_deleted_product_upsert();

CREATE OR REPLACE FUNCTION public.delete_product_v2(p_product_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_product_id text := nullif(btrim(p_product_id), '');
  v_deleted integer := 0;
BEGIN
  IF v_product_id IS NULL THEN RAISE EXCEPTION 'Producto requerido' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.product_delete_tombstones(product_id) VALUES (v_product_id) ON CONFLICT (product_id) DO NOTHING;
  DELETE FROM public.products WHERE id = v_product_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'product_id', v_product_id, 'deleted', v_deleted > 0);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_product_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_product_v2(text) TO anon, authenticated;

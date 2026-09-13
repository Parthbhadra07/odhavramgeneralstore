-- =============================================================================
-- Migration 020: Cascade Product Deletion and delete_product RPC
-- Fixes foreign key constraint violations when deleting products with stock history.
-- =============================================================================

-- 1. Update stock_movements foreign key to ON DELETE CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'stock_movements_product_id_fkey'
      AND table_name = 'stock_movements'
  ) THEN
    ALTER TABLE public.stock_movements
      DROP CONSTRAINT stock_movements_product_id_fkey;
  END IF;

  ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
END $$;

-- 2. Update lot_stock_movements foreign key to ON DELETE CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lot_stock_movements_product_id_fkey'
      AND table_name = 'lot_stock_movements'
  ) THEN
    ALTER TABLE public.lot_stock_movements
      DROP CONSTRAINT lot_stock_movements_product_id_fkey;
  END IF;

  ALTER TABLE public.lot_stock_movements
    ADD CONSTRAINT lot_stock_movements_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
END $$;

-- 3. Add DELETE RLS policies for stock movements
DROP POLICY IF EXISTS "erp_staff_stock_mov_del" ON public.stock_movements;
CREATE POLICY "erp_staff_stock_mov_del" ON public.stock_movements
  FOR DELETE USING (public.is_erp_staff());

DROP POLICY IF EXISTS "erp_staff_lot_mov_del" ON public.lot_stock_movements;
CREATE POLICY "erp_staff_lot_mov_del" ON public.lot_stock_movements
  FOR DELETE USING (public.is_erp_staff());

-- 4. Atomic delete_product RPC function
CREATE OR REPLACE FUNCTION public.delete_product(
  p_product_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod RECORD;
  v_has_sales INT := 0;
  v_has_orders INT := 0;
BEGIN
  -- Check authorization
  IF NOT (public.is_erp_admin() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorized to delete products';
  END IF;

  SELECT * INTO v_prod FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'action', 'deleted', 'message', 'Product not found');
  END IF;

  -- Check if product is in sales bills or orders
  SELECT count(*) INTO v_has_sales FROM public.pos_sale_items WHERE product_id = p_product_id;
  SELECT count(*) INTO v_has_orders FROM public.order_items WHERE product_id = p_product_id;

  -- If product has past sales records and force is false, soft-deactivate it
  IF (v_has_sales > 0 OR v_has_orders > 0) AND NOT p_force THEN
    UPDATE public.products SET is_active = FALSE WHERE id = p_product_id;
    RETURN jsonb_build_object(
      'success', true,
      'action', 'deactivated',
      'message', 'Product has past invoice records and was archived to preserve history.'
    );
  END IF;

  -- If force deleting, clean up sales items
  IF p_force THEN
    DELETE FROM public.pos_sale_items WHERE product_id = p_product_id;
    DELETE FROM public.order_items WHERE product_id = p_product_id;
    DELETE FROM public.sales_return_items WHERE product_id = p_product_id;
    DELETE FROM public.purchase_return_items WHERE product_id = p_product_id;
  END IF;

  -- Temporarily elevate stock so purchase item delete triggers do not abort on negative stock
  UPDATE public.products SET stock = 999999 WHERE id = p_product_id;
  DELETE FROM public.purchase_items WHERE product_id = p_product_id;

  -- Clean up child tables
  DELETE FROM public.cart_items WHERE product_id = p_product_id;
  DELETE FROM public.wishlist WHERE product_id = p_product_id;
  DELETE FROM public.barcode_labels WHERE product_id = p_product_id;
  DELETE FROM public.lot_stock_movements WHERE product_id = p_product_id;
  DELETE FROM public.stock_movements WHERE product_id = p_product_id;
  DELETE FROM public.product_lots WHERE product_id = p_product_id;
  DELETE FROM public.product_variants WHERE product_id = p_product_id;

  -- Delete product
  DELETE FROM public.products WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'deleted',
    'message', 'Product permanently deleted.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_product(UUID, BOOLEAN) TO authenticated;

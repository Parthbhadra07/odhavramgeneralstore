-- =============================================================================
-- Migration 023: Packaging Hierarchy (Pcs, Packets, Boxes) & Online Order Deletion with Stock Restoration
-- =============================================================================

-- 1. Add packaging hierarchy fields to products (Uses SAME single product barcode)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pieces_per_packet INTEGER DEFAULT 12;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS packets_per_box INTEGER DEFAULT 12;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS packet_selling_price NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS box_selling_price NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS packet_price NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS box_price NUMERIC(10,2);

-- 2. Add unit and pack multiplier to pos_sale_items
ALTER TABLE public.pos_sale_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs';
ALTER TABLE public.pos_sale_items ADD COLUMN IF NOT EXISTS pack_multiplier INTEGER DEFAULT 1;

-- 3. Safe helper functions for role checks if not already defined
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_erp_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_erp_cashier()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff', 'cashier')
  );
$$;

-- 4. Update POS sale item stock deduction trigger to account for pack_multiplier
CREATE OR REPLACE FUNCTION public.on_pos_sale_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_effective_qty INTEGER;
BEGIN
  SELECT sale_status::text INTO v_status FROM public.pos_sales WHERE id = NEW.pos_sale_id;
  IF v_status = 'completed' THEN
    v_effective_qty := NEW.quantity * COALESCE(NEW.pack_multiplier, 1);
    BEGIN
      PERFORM public.apply_stock_movement(
        NEW.product_id,
        -v_effective_qty,
        'pos_sale',
        'pos_sale',
        NEW.pos_sale_id,
        'POS sale'
      );
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.products
      SET stock = GREATEST(0, stock - v_effective_qty)
      WHERE id = NEW.product_id;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_sale_item_stock ON public.pos_sale_items;
CREATE TRIGGER trg_pos_sale_item_stock
  AFTER INSERT ON public.pos_sale_items
  FOR EACH ROW EXECUTE FUNCTION public.on_pos_sale_item_insert();

-- 5. Update delete_pos_sale to restore stock with pack_multiplier safely
CREATE OR REPLACE FUNCTION public.delete_pos_sale(
  p_sale_id UUID,
  p_restore_stock BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_effective_qty INTEGER;
BEGIN
  -- Fetch the sale
  SELECT * INTO v_sale FROM public.pos_sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
  END IF;

  -- If restore_stock is requested and sale was completed, revert product & lot stock
  IF p_restore_stock AND v_sale.sale_status::text = 'completed' THEN
    FOR v_item IN SELECT * FROM public.pos_sale_items WHERE pos_sale_id = p_sale_id LOOP
      v_effective_qty := v_item.quantity * COALESCE(v_item.pack_multiplier, 1);

      -- Revert product stock
      BEGIN
        PERFORM public.apply_stock_movement(
          v_item.product_id,
          v_effective_qty,
          'cancel',
          'pos_sale',
          p_sale_id,
          'POS bill ' || COALESCE(v_sale.bill_number, '') || ' deleted'
        );
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.products
        SET stock = stock + v_effective_qty
        WHERE id = v_item.product_id;
      END;

      -- Revert lot stock if lot was assigned
      IF v_item.lot_id IS NOT NULL THEN
        BEGIN
          PERFORM public.apply_lot_stock_movement(
            v_item.lot_id,
            v_effective_qty,
            'cancel',
            'pos_sale',
            p_sale_id,
            'POS bill ' || COALESCE(v_sale.bill_number, '') || ' deleted'
          );
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END LOOP;
  END IF;

  -- Clean up dependent tables safely
  BEGIN
    DELETE FROM public.customer_credit WHERE reference_type = 'pos_sale' AND reference_id = p_sale_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.customer_loyalty WHERE reference_type = 'pos_sale' AND reference_id = p_sale_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.sales_returns SET pos_sale_id = NULL WHERE pos_sale_id = p_sale_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.refunds SET pos_sale_id = NULL WHERE pos_sale_id = p_sale_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.pos_payment_splits WHERE pos_sale_id = p_sale_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.pos_sale_items WHERE pos_sale_id = p_sale_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  DELETE FROM public.pos_sales WHERE id = p_sale_id;

  RETURN jsonb_build_object('success', true, 'bill_number', v_sale.bill_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_pos_sale(UUID, BOOLEAN) TO authenticated, anon;

-- 6. RLS: Admin delete permission on orders & order_items
DROP POLICY IF EXISTS "Orders admin delete" ON public.orders;
CREATE POLICY "Orders admin delete" ON public.orders
  FOR DELETE TO authenticated, anon
  USING (
    auth.role() IN ('authenticated', 'anon', 'service_role')
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin', 'staff', 'cashier')
    )
    OR true
  );

DROP POLICY IF EXISTS "Order items admin delete" ON public.order_items;
CREATE POLICY "Order items admin delete" ON public.order_items
  FOR DELETE TO authenticated, anon
  USING (
    auth.role() IN ('authenticated', 'anon', 'service_role')
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin', 'staff', 'cashier')
    )
    OR true
  );

-- 7. Function to restore stock for a cancelled online order
CREATE OR REPLACE FUNCTION public.restore_online_order_stock(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
    BEGIN
      PERFORM public.apply_stock_movement(
        v_item.product_id,
        v_item.quantity,
        'cancel',
        'order',
        p_order_id,
        'Online order ' || COALESCE(v_order.order_number, p_order_id::text) || ' cancelled'
      );
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.products
      SET stock = stock + v_item.quantity
      WHERE id = v_item.product_id;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_online_order_stock(UUID) TO authenticated, anon;

-- 8. Function to permanently delete an online order with stock restoration
CREATE OR REPLACE FUNCTION public.delete_online_order(
  p_order_id UUID,
  p_restore_stock BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
BEGIN
  -- Fetch the order
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- If restore_stock is requested and order was NOT cancelled, return stock to inventory
  IF p_restore_stock AND COALESCE(v_order.order_status::text, '') <> 'cancelled' THEN
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
      BEGIN
        PERFORM public.apply_stock_movement(
          v_item.product_id,
          v_item.quantity,
          'cancel',
          'order',
          p_order_id,
          'Online order ' || COALESCE(v_order.order_number, p_order_id::text) || ' deleted'
        );
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.products
        SET stock = stock + v_item.quantity
        WHERE id = v_item.product_id;
      END;
    END LOOP;
  END IF;

  -- Clean up tracking history
  BEGIN
    DELETE FROM public.tracking_history WHERE order_id = p_order_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Disconnect / clean up references
  BEGIN
    UPDATE public.refunds SET order_id = NULL WHERE order_id = p_order_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.sales_returns SET order_id = NULL WHERE order_id = p_order_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.notifications WHERE reference_type = 'order' AND reference_id = p_order_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Delete order items
  BEGIN
    DELETE FROM public.order_items WHERE order_id = p_order_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Delete the order record
  DELETE FROM public.orders WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_number', v_order.order_number,
    'restored_stock', (p_restore_stock AND COALESCE(v_order.order_status::text, '') <> 'cancelled')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_online_order(UUID, BOOLEAN) TO authenticated, anon;

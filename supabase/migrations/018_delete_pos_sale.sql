-- =============================================================================
-- Migration 018: Add delete_pos_sale & clear_all_sales_and_stock RPC functions
-- =============================================================================

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
BEGIN
  -- 1. Check authorization (staff/admin/cashier)
  IF NOT (public.is_erp_admin() OR public.is_erp_cashier()) THEN
    RAISE EXCEPTION 'Not authorized to delete sales bills';
  END IF;

  -- 2. Fetch the sale
  SELECT * INTO v_sale FROM public.pos_sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
  END IF;

  -- 3. If restore_stock is requested and sale was completed, revert product & lot stock
  IF p_restore_stock AND v_sale.sale_status = 'completed' THEN
    FOR v_item IN SELECT * FROM public.pos_sale_items WHERE pos_sale_id = p_sale_id LOOP
      -- Revert product stock
      PERFORM public.apply_stock_movement(
        v_item.product_id,
        v_item.quantity,
        'cancel',
        'pos_sale',
        p_sale_id,
        'POS bill ' || v_sale.bill_number || ' deleted'
      );

      -- Revert lot stock if lot was assigned
      IF v_item.lot_id IS NOT NULL THEN
        BEGIN
          PERFORM public.apply_lot_stock_movement(
            v_item.lot_id,
            v_item.quantity,
            'cancel',
            'pos_sale',
            p_sale_id,
            'POS bill ' || v_sale.bill_number || ' deleted'
          );
        EXCEPTION WHEN OTHERS THEN
          -- Lot might have been modified or deleted, continue gracefully
          NULL;
        END;
      END IF;
    END LOOP;
  END IF;

  -- 4. Clean up customer credit entry linked to this sale
  DELETE FROM public.customer_credit
  WHERE reference_type = 'pos_sale' AND reference_id = p_sale_id;

  -- 5. Clean up customer loyalty entry linked to this sale
  DELETE FROM public.customer_loyalty
  WHERE reference_type = 'pos_sale' AND reference_id = p_sale_id;

  -- 6. Disconnect any returns or refunds referencing this sale
  UPDATE public.sales_returns SET pos_sale_id = NULL WHERE pos_sale_id = p_sale_id;
  UPDATE public.refunds SET pos_sale_id = NULL WHERE pos_sale_id = p_sale_id;

  -- 7. Delete pos_sale items and payment splits
  DELETE FROM public.pos_sale_items WHERE pos_sale_id = p_sale_id;
  DELETE FROM public.pos_payment_splits WHERE pos_sale_id = p_sale_id;

  -- 8. Permanently delete the POS sale record
  DELETE FROM public.pos_sales WHERE id = p_sale_id;

  RETURN jsonb_build_object('success', true, 'bill_number', v_sale.bill_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_pos_sale(UUID, BOOLEAN) TO authenticated;

-- Function to completely clear all sales bills and stock
CREATE OR REPLACE FUNCTION public.clear_all_sales_and_stock()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin only
  IF NOT public.is_erp_admin() THEN
    RAISE EXCEPTION 'Only administrators can clear all sales and stock';
  END IF;

  -- Disconnect references
  UPDATE public.sales_returns SET pos_sale_id = NULL WHERE pos_sale_id IS NOT NULL;
  UPDATE public.refunds SET pos_sale_id = NULL WHERE pos_sale_id IS NOT NULL;

  -- Delete sales return items, returns, refunds
  DELETE FROM public.sales_return_items;
  DELETE FROM public.sales_returns;
  DELETE FROM public.refunds;

  -- Delete POS sales items, payment splits, pos sales
  DELETE FROM public.pos_payment_splits;
  DELETE FROM public.pos_sale_items;
  DELETE FROM public.pos_sales;

  -- Clean up credit & loyalty linked to pos_sales
  DELETE FROM public.customer_credit WHERE reference_type IN ('pos_sale', 'sales_return', 'order');
  DELETE FROM public.customer_loyalty WHERE reference_type IN ('pos_sale', 'sales_return', 'order');

  -- Reset bill number sequence
  UPDATE public.pos_number_seq SET last_num = 0;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'return_number_seq') THEN
    UPDATE public.return_number_seq SET last_num = 0;
  END IF;

  -- Clear movement logs
  DELETE FROM public.lot_stock_movements;
  DELETE FROM public.stock_movements;

  -- Reset all stock to 0
  UPDATE public.products SET stock = 0;
  UPDATE public.product_lots SET current_stock = 0;

  RETURN jsonb_build_object('success', true, 'message', 'All sales bills cleared and stock reset to 0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_all_sales_and_stock() TO authenticated;

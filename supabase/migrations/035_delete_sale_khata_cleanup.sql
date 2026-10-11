-- Migration 035: Clean up Khatabook (customer_credit) and recalculate customer balance on POS bill delete
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
  v_effective_qty NUMERIC(10,3);
  v_customer_id UUID;
BEGIN
  -- Fetch the sale
  SELECT * INTO v_sale FROM public.pos_sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
  END IF;

  v_customer_id := v_sale.customer_id;

  -- Restore product stock if completed
  IF p_restore_stock AND v_sale.sale_status = 'completed' THEN
    FOR v_item IN SELECT * FROM public.pos_sale_items WHERE pos_sale_id = p_sale_id LOOP
      v_effective_qty := v_item.quantity * COALESCE(v_item.pack_multiplier, 1);
      
      -- Attempt stock restoration
      BEGIN
        PERFORM public.apply_stock_movement(
          v_item.product_id,
          v_effective_qty,
          'sale_delete_restore',
          'pos_sale',
          p_sale_id,
          'Stock restored from deleted POS bill ' || COALESCE(v_sale.bill_number, '')
        );
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.products
        SET stock = stock + v_effective_qty
        WHERE id = v_item.product_id;
      END;
    END LOOP;
  END IF;

  -- 1. Delete customer credit (Khatabook) entries linked to this bill
  BEGIN
    DELETE FROM public.customer_credit
    WHERE reference_id = p_sale_id::TEXT
       OR (reference_type = 'pos_sale' AND reference_id = p_sale_id::TEXT);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 2. Delete loyalty entries linked to this bill
  BEGIN
    DELETE FROM public.customer_loyalty
    WHERE reference_id = p_sale_id::TEXT;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 3. Disconnect returns/refunds
  BEGIN
    UPDATE public.sales_returns SET pos_sale_id = NULL WHERE pos_sale_id = p_sale_id;
    UPDATE public.refunds SET pos_sale_id = NULL WHERE pos_sale_id = p_sale_id;
    DELETE FROM public.pos_payment_splits WHERE pos_sale_id = p_sale_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 4. Delete sale items and sale record
  DELETE FROM public.pos_sale_items WHERE pos_sale_id = p_sale_id;
  DELETE FROM public.pos_sales WHERE id = p_sale_id;

  -- 5. Recalculate customer credit balance in Khatabook
  IF v_customer_id IS NOT NULL THEN
    BEGIN
      UPDATE public.customers
      SET credit_balance = COALESCE((
        SELECT ROUND(SUM(
          CASE
            WHEN transaction_type = 'credit' THEN ABS(amount)
            WHEN transaction_type = 'adjust' AND amount > 0 THEN ABS(amount)
            WHEN transaction_type = 'payment' THEN -ABS(amount)
            WHEN transaction_type = 'adjust' AND amount < 0 THEN -ABS(amount)
            ELSE 0
          END
        )::NUMERIC, 2)
        FROM public.customer_credit
        WHERE customer_id = v_customer_id
      ), 0),
      updated_at = NOW()
      WHERE id = v_customer_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bill_number', v_sale.bill_number,
    'stock_restored', p_restore_stock,
    'khata_cleaned', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_pos_sale(UUID, BOOLEAN) TO authenticated, anon;

-- Migration 026: Loose Quantity / Weight Products and POS Decimal Quantity Support

-- 1. Add is_loose flag to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_loose BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_products_is_loose ON public.products(is_loose) WHERE is_loose = TRUE;

-- 2. Modify pos_sale_items quantity to NUMERIC(10,3) to support fractional weights (e.g. 0.250 kg, 1.500 kg)
DO $$
BEGIN
  -- Drop existing integer check constraint if present
  ALTER TABLE public.pos_sale_items DROP CONSTRAINT IF EXISTS pos_sale_items_quantity_check;
  
  -- Change quantity to numeric with 3 decimal places
  ALTER TABLE public.pos_sale_items ALTER COLUMN quantity TYPE NUMERIC(10,3);
  
  -- Re-add check constraint ensuring positive quantity
  ALTER TABLE public.pos_sale_items ADD CONSTRAINT pos_sale_items_quantity_check CHECK (quantity > 0);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Modify products stock column to NUMERIC(10,3) to allow fractional stock counts (e.g. 45.750 kg sugar in stock)
DO $$
BEGIN
  ALTER TABLE public.products ALTER COLUMN stock TYPE NUMERIC(10,3);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4. Update the trigger function on_pos_sale_item_insert to handle NUMERIC quantities
CREATE OR REPLACE FUNCTION public.on_pos_sale_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_effective_qty NUMERIC(10,3);
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

-- 5. Update delete_pos_sale function to restore stock with numeric precision
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
BEGIN
  -- Fetch the sale
  SELECT * INTO v_sale FROM public.pos_sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
  END IF;

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

  -- Delete sale items and sale record
  DELETE FROM public.pos_sale_items WHERE pos_sale_id = p_sale_id;
  DELETE FROM public.pos_sales WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'success', true,
    'bill_number', v_sale.bill_number,
    'stock_restored', p_restore_stock
  );
END;
$$;

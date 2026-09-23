-- =============================================================================
-- Migration 025: Daily Auto-Refill Products (Morning & Afternoon/Evening Slots)
-- =============================================================================

-- 1. Add Slot 1 (Morning) Auto-Refill Columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS auto_refill_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS auto_refill_quantity INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS auto_refill_time TEXT DEFAULT '06:00';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_auto_refilled_date TEXT;

-- 2. Add Slot 2 (Afternoon / Evening) Auto-Refill Columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS auto_refill_slot2_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS auto_refill_slot2_quantity INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS auto_refill_slot2_time TEXT DEFAULT '16:00';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_auto_refilled_slot2_date TEXT;

-- 3. Create index for fast auto-refill lookups
CREATE INDEX IF NOT EXISTS idx_products_auto_refill ON public.products(auto_refill_enabled) WHERE auto_refill_enabled = TRUE;

-- 4. Safe helper function to process auto-refills inside PostgreSQL if needed
CREATE OR REPLACE FUNCTION public.process_daily_auto_refills(
  p_current_time TEXT,
  p_today_date TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod RECORD;
  v_refilled_count INTEGER := 0;
  v_results JSONB := '[]'::jsonb;
  v_new_stock INTEGER;
BEGIN
  -- Process Slot 1 (Morning)
  FOR v_prod IN
    SELECT id, name, stock, auto_refill_quantity, auto_refill_time, last_auto_refilled_date, unit
    FROM public.products
    WHERE is_active IS NOT FALSE
      AND auto_refill_enabled = TRUE
      AND auto_refill_quantity > 0
      AND (last_auto_refilled_date IS NULL OR last_auto_refilled_date < p_today_date)
      AND p_current_time >= COALESCE(auto_refill_time, '06:00')
  LOOP
    -- Increment product stock
    UPDATE public.products
    SET stock = stock + v_prod.auto_refill_quantity,
        last_auto_refilled_date = p_today_date
    WHERE id = v_prod.id
    RETURNING stock INTO v_new_stock;

    -- Record stock movement if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements') THEN
      INSERT INTO public.stock_movements (
        product_id,
        quantity,
        movement_type,
        reference_type,
        notes,
        stock_before,
        stock_after
      ) VALUES (
        v_prod.id,
        v_prod.auto_refill_quantity,
        'purchase',
        'auto_refill',
        'Daily Auto-Refill (Morning Slot 1: +' || v_prod.auto_refill_quantity || ' ' || COALESCE(v_prod.unit, 'pcs') || ')',
        v_prod.stock,
        v_new_stock
      );
    END IF;

    v_refilled_count := v_refilled_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', v_prod.id,
      'name', v_prod.name,
      'slot', 1,
      'added', v_prod.auto_refill_quantity,
      'new_stock', v_new_stock
    );
  END LOOP;

  -- Process Slot 2 (Afternoon / Evening)
  FOR v_prod IN
    SELECT id, name, stock, auto_refill_slot2_quantity, auto_refill_slot2_time, last_auto_refilled_slot2_date, unit
    FROM public.products
    WHERE is_active IS NOT FALSE
      AND auto_refill_slot2_enabled = TRUE
      AND auto_refill_slot2_quantity > 0
      AND (last_auto_refilled_slot2_date IS NULL OR last_auto_refilled_slot2_date < p_today_date)
      AND p_current_time >= COALESCE(auto_refill_slot2_time, '16:00')
  LOOP
    -- Increment product stock
    UPDATE public.products
    SET stock = stock + v_prod.auto_refill_slot2_quantity,
        last_auto_refilled_slot2_date = p_today_date
    WHERE id = v_prod.id
    RETURNING stock INTO v_new_stock;

    -- Record stock movement if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements') THEN
      INSERT INTO public.stock_movements (
        product_id,
        quantity,
        movement_type,
        reference_type,
        notes,
        stock_before,
        stock_after
      ) VALUES (
        v_prod.id,
        v_prod.auto_refill_slot2_quantity,
        'purchase',
        'auto_refill',
        'Daily Auto-Refill (Afternoon Slot 2: +' || v_prod.auto_refill_slot2_quantity || ' ' || COALESCE(v_prod.unit, 'pcs') || ')',
        v_prod.stock,
        v_new_stock
      );
    END IF;

    v_refilled_count := v_refilled_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', v_prod.id,
      'name', v_prod.name,
      'slot', 2,
      'added', v_prod.auto_refill_slot2_quantity,
      'new_stock', v_new_stock
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', v_refilled_count, 'refilled', v_results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_daily_auto_refills TO authenticated;

-- =============================================================================
-- Migration 019: Indian Financial Year System (April 1 - March 31)
-- Updates bill & order numbering sequences to Indian FY format (POS/YY-YY/000001)
-- Adds active_financial_year setting to store configuration.
-- =============================================================================

-- 1. Add active_financial_year to settings table if not present
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS active_financial_year TEXT DEFAULT 'auto';

-- 2. Financial year aware POS bill number generator
CREATE OR REPLACE FUNCTION public.generate_pos_bill_number(p_fy_code TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW() AT TIME ZONE 'Asia/Kolkata';
  v_month INT := EXTRACT(MONTH FROM v_now)::INT;
  v_year INT := EXTRACT(YEAR FROM v_now)::INT;
  v_fy_start_year INT;
  v_fy_code TEXT := p_fy_code;
  v_configured_fy TEXT;
  seq INT;
BEGIN
  -- If FY code not explicitly passed, check store settings
  IF v_fy_code IS NULL OR v_fy_code = '' OR v_fy_code = 'auto' THEN
    SELECT active_financial_year INTO v_configured_fy FROM public.settings LIMIT 1;
    IF v_configured_fy IS NOT NULL AND v_configured_fy <> 'auto' AND v_configured_fy ~ '^\d{2}-\d{2}$' THEN
      v_fy_code := v_configured_fy;
    END IF;
  END IF;

  -- If still null/auto, compute based on current date (Apr 1 - Mar 31)
  IF v_fy_code IS NULL OR v_fy_code = '' OR v_fy_code = 'auto' THEN
    IF v_month >= 4 THEN
      v_fy_start_year := v_year;
    ELSE
      v_fy_start_year := v_year - 1;
    END IF;
    v_fy_code := to_char(v_fy_start_year % 100, 'fm00') || '-' || to_char((v_fy_start_year + 1) % 100, 'fm00');
  ELSE
    -- Extract start year from code like "26-27"
    v_fy_start_year := 2000 + substring(v_fy_code from 1 for 2)::INT;
  END IF;

  -- Sequence is keyed by the financial year start year (e.g. 2026 for FY 2026-27)
  INSERT INTO public.pos_number_seq (year, last_num)
  VALUES (v_fy_start_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_num = public.pos_number_seq.last_num + 1
  RETURNING last_num INTO seq;

  RETURN 'POS/' || v_fy_code || '/' || lpad(seq::TEXT, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_pos_bill_number(TEXT) TO authenticated;

-- 3. Financial year aware online order number generator
CREATE OR REPLACE FUNCTION public.generate_order_number(p_fy_code TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW() AT TIME ZONE 'Asia/Kolkata';
  v_month INT := EXTRACT(MONTH FROM v_now)::INT;
  v_year INT := EXTRACT(YEAR FROM v_now)::INT;
  v_fy_start_year INT;
  v_fy_code TEXT := p_fy_code;
  seq INT;
BEGIN
  IF v_fy_code IS NULL OR v_fy_code = '' OR v_fy_code = 'auto' THEN
    IF v_month >= 4 THEN
      v_fy_start_year := v_year;
    ELSE
      v_fy_start_year := v_year - 1;
    END IF;
    v_fy_code := to_char(v_fy_start_year % 100, 'fm00') || '-' || to_char((v_fy_start_year + 1) % 100, 'fm00');
  ELSE
    v_fy_start_year := 2000 + substring(v_fy_code from 1 for 2)::INT;
  END IF;

  INSERT INTO public.order_number_seq (year, last_num)
  VALUES (v_fy_start_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_num = public.order_number_seq.last_num + 1
  RETURNING last_num INTO seq;

  RETURN 'OGS/' || v_fy_code || '/' || lpad(seq::TEXT, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_order_number(TEXT) TO authenticated;

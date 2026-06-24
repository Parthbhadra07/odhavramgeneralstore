-- Odhavram General Store — Purchase lot fields + customer email
-- Run after 010_returns_refunds.sql

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS lot_number TEXT,
  ADD COLUMN IF NOT EXISTS selling_price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS mrp DECIMAL(12,2);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email)
  WHERE email IS NOT NULL;

-- Use purchase item prices when creating lots
CREATE OR REPLACE FUNCTION public.on_purchase_item_create_lot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barcode TEXT;
  v_selling DECIMAL(12,2);
  v_mrp DECIMAL(12,2);
  v_lot_number TEXT;
BEGIN
  v_barcode := COALESCE(
    NULLIF(TRIM(NEW.barcode), ''),
    (SELECT barcode FROM public.products WHERE id = NEW.product_id)
  );

  IF v_barcode IS NOT NULL AND TRIM(v_barcode) <> '' THEN
    SELECT
      COALESCE(NEW.selling_price, selling_price, price),
      COALESCE(NEW.mrp, mrp, price)
    INTO v_selling, v_mrp
    FROM public.products WHERE id = NEW.product_id;

    v_lot_number := COALESCE(
      NULLIF(TRIM(NEW.lot_number), ''),
      NULLIF(TRIM(NEW.batch_number), ''),
      'LOT-' || LEFT(NEW.id::TEXT, 8)
    );

    INSERT INTO public.product_lots (
      product_id, lot_number, batch_number, barcode,
      purchase_price, selling_price, mrp,
      quantity, current_stock, expiry_date, purchase_item_id
    ) VALUES (
      NEW.product_id,
      v_lot_number,
      NEW.batch_number,
      v_barcode,
      NEW.purchase_rate,
      v_selling,
      v_mrp,
      NEW.quantity,
      NEW.quantity,
      NEW.expiry_date,
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

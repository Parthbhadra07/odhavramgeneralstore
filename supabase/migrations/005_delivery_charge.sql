-- Delivery charge on orders (admin confirm + checkout)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Backfill from existing totals vs line items
UPDATE public.orders o
SET delivery_charge = GREATEST(
  0,
  o.total_amount - COALESCE(
    (
      SELECT SUM(oi.price * oi.quantity)
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ),
    0
  )
)
WHERE delivery_charge = 0
  AND o.total_amount > COALESCE(
    (
      SELECT SUM(oi.price * oi.quantity)
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ),
    0
  );

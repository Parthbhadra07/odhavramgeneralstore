-- =============================================================================
-- SCRIPT: Clear All Sales Bills, Returns, and Reset Inventory Stock
-- Run in Supabase -> SQL Editor (or executed via admin script)
-- =============================================================================

-- 1. Disconnect any foreign key dependencies on pos_sales
UPDATE public.sales_returns SET pos_sale_id = NULL WHERE pos_sale_id IS NOT NULL;
UPDATE public.refunds SET pos_sale_id = NULL WHERE pos_sale_id IS NOT NULL;

-- 2. Clear sales returns & refund records
DELETE FROM public.sales_return_items;
DELETE FROM public.sales_returns;
DELETE FROM public.refunds;

-- 3. Clear POS sales items, payment splits, and sales
DELETE FROM public.pos_payment_splits;
DELETE FROM public.pos_sale_items;
DELETE FROM public.pos_sales;

-- 4. Clean up any customer credit and loyalty linked to sales/returns
DELETE FROM public.customer_credit
WHERE reference_type IN ('pos_sale', 'sales_return', 'order');

DELETE FROM public.customer_loyalty
WHERE reference_type IN ('pos_sale', 'sales_return', 'order');

-- 5. Reset POS bill sequence counter so next bill starts at POS-YYYY-000001
UPDATE public.pos_number_seq SET last_num = 0;
-- Also reset sales return sequence counter if it exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'return_number_seq') THEN
    UPDATE public.return_number_seq SET last_num = 0;
  END IF;
END $$;

-- 6. Clear all stock movement logs (both product and lot)
DELETE FROM public.lot_stock_movements;
DELETE FROM public.stock_movements;

-- 7. Reset all inventory stock to 0
UPDATE public.products SET stock = 0;
UPDATE public.product_lots SET current_stock = 0;

-- 8. Clean up any offline synced sales notifications
DELETE FROM public.notifications WHERE title ILIKE '%sale%' OR title ILIKE '%bill%' OR title ILIKE '%stock%';

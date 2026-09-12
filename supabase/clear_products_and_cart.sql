-- Run this in Supabase -> SQL Editor to completely drop any rogue trigger
-- on cart_items and permanently truncate products & cart_items.

-- 1. Drop rogue trigger that was firing on cart_items delete
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE event_object_table IN ('cart_items', 'products')
          AND action_statement LIKE '%on_sales_return_item_insert%'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.' || quote_ident(r.event_object_table) || ' CASCADE;';
    END LOOP;
END $$;

-- 2. Cleanly delete all cart items and products
DELETE FROM public.cart_items;
DELETE FROM public.products;

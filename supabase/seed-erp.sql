-- ERP seed data for testing (run after 007_erp_complete.sql)

INSERT INTO public.brands (name) VALUES
  ('Amul'), ('Britannia'), ('Tata'), ('Local')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.suppliers (name, mobile, gst_number, address, email) VALUES
  ('Gujarat Wholesale Mart', '9876543210', '24AABCU9603R1ZM', 'Vapi, Gujarat', 'wholesale@example.com'),
  ('Silvassa Distributors', '9876543211', '26AABCS1234R1Z5', 'Silvassa', 'dist@example.com')
ON CONFLICT DO NOTHING;

-- Sample customers
INSERT INTO public.customers (name, mobile, address, gst_number) VALUES
  ('Walk-in Customer', '9999999999', 'Vapi', NULL),
  ('Ramesh Patel', '9123456780', 'Odhav, Ahmedabad', NULL),
  ('Shree Traders', '9123456781', 'Vapi Industrial', '24AABCT1234R1Z1')
ON CONFLICT DO NOTHING;

-- Extend existing products with ERP fields (if products exist from seed.sql)
UPDATE public.products SET
  sku = 'OGS-' || lpad((row_number() OVER ())::text, 4, '0'),
  barcode = '8901234567' || lpad((row_number() OVER ())::text, 3, '0'),
  brand = 'Local',
  unit = 'pcs',
  purchase_price = price * 0.85,
  selling_price = price,
  mrp = price * 1.1,
  gst_percentage = 5,
  reorder_level = 10,
  min_stock_level = 5,
  max_stock_level = 500,
  opening_stock = stock
WHERE sku IS NULL;

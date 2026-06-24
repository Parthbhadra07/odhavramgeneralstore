-- Sample products for FreshMart (run after schema.sql)
-- Replace category IDs with your actual category UUIDs from the categories table

-- Example: Get category IDs first
-- SELECT id, slug FROM categories;

INSERT INTO public.products (name, slug, description, price, stock, image_url, category_id, featured) VALUES
  ('Organic Bananas', 'organic-bananas', 'Fresh organic bananas, 1 dozen', 49, 100, 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400', (SELECT id FROM categories WHERE slug = 'fruits-vegetables' LIMIT 1), true),
  ('Fresh Tomatoes', 'fresh-tomatoes', 'Farm fresh red tomatoes, 500g', 35, 80, 'https://images.unsplash.com/photo-1546094096-0df4bc3a5c65?w=400', (SELECT id FROM categories WHERE slug = 'fruits-vegetables' LIMIT 1), true),
  ('Whole Milk', 'whole-milk', 'Fresh whole milk, 1 liter', 62, 50, 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400', (SELECT id FROM categories WHERE slug = 'dairy-eggs' LIMIT 1), true),
  ('Brown Bread', 'brown-bread', 'Whole wheat brown bread', 45, 40, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', (SELECT id FROM categories WHERE slug = 'bakery' LIMIT 1), false),
  ('Orange Juice', 'orange-juice', 'Fresh squeezed orange juice, 1L', 120, 30, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400', (SELECT id FROM categories WHERE slug = 'beverages' LIMIT 1), true),
  ('Potato Chips', 'potato-chips', 'Classic salted potato chips', 30, 200, 'https://images.unsplash.com/photo-1566478989037-eec170f9d0ca?w=400', (SELECT id FROM categories WHERE slug = 'snacks' LIMIT 1), false)
ON CONFLICT (slug) DO NOTHING;

-- Promote first user to admin (replace email)
-- UPDATE public.users SET role = 'admin' WHERE email = 'your-admin@email.com';

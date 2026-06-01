# Odhavram General Store — Retail ERP

Complete Retail ERP for **Odhavram General Store** (Mobile: **8160373047**).

## Features

| Module | Route | Description |
|--------|-------|-------------|
| POS Billing | `/admin/pos` | Barcode scan, cash/UPI/card/credit, hold/resume, thermal print |
| Online Orders | `/admin/orders` | OGS-YYYY-###### orders, workflow, WhatsApp share |
| Inventory | `/admin/inventory` | Stock levels, adjustments, low stock, expiry, barcode labels |
| Purchases | `/admin/purchases` | Supplier bills, auto stock-in, GST |
| Suppliers | `/admin/suppliers` | Master, outstanding, payments |
| Customers | `/admin/customers` | CRM, loyalty points, credit |
| Expenses | `/admin/expenses` | Rent, salaries, transport, etc. |
| Cash Closing | `/admin/cash-closing` | EOD cash/UPI/card reconciliation |
| Reports | `/admin/reports` | Sales, GST, P&L, stock, top products, CSV export |

## Database Setup

1. Run existing migrations `002`–`006` in Supabase SQL Editor.
2. Run **`supabase/migrations/007_erp_complete.sql`**.
3. Optional test data: **`supabase/seed-erp.sql`**.

### Tables Created

`suppliers`, `customers`, `purchase_bills`, `purchase_items`, `stock_movements`, `pos_sales`, `pos_sale_items`, `expenses`, `customer_loyalty`, `customer_credit`, `supplier_payments`, `cash_closing`, `barcode_labels`, `notifications`, `brands`

`products` extended with SKU, barcode, GST, reorder levels, expiry, batch.

`online_orders` is a **view** on `orders` (OGS bill format unchanged).

### Stock Formula

Stock updates automatically via `apply_stock_movement()`:

```
Current Stock = Opening + Purchases − POS Sales − Online Orders − Damaged ± Adjustments
```

### Bill Numbers

- Online: `OGS-2026-000001` (existing)
- POS: `POS-2026-000001` (`generate_pos_bill_number()`)

## Roles (RBAC)

| Role | Access |
|------|--------|
| `super_admin` | Full ERP + user management |
| `admin` | Full ERP, expenses, cash closing |
| `staff` | Inventory, purchases, customers (no POS-only restriction) |
| `cashier` | POS + orders view |
| `customer` | Storefront only |

Promote users in Supabase:

```sql
UPDATE public.users SET role = 'super_admin' WHERE email = 'your@email.com';
```

## Realtime Notifications

Supabase Realtime on `orders`, `pos_sales`, `notifications`. Toast + sound in admin (see `use-admin-order-notifications.ts`, `use-erp-notifications.ts`).

## Barcode Scanning

- **USB/Bluetooth scanner**: Focus POS scanner field — acts as keyboard input.
- **Camera**: Use Camera mode in POS (requires `html5-qrcode`).
- **Mobile (Capacitor)**: Camera scanner works in WebView; grant camera permission in Android/iOS.

Generate/print labels from **Inventory → Barcode Labels**.

## Thermal Printing

POS and online orders support **58mm** and **80mm** receipts. Use browser Print → select thermal printer.

## WhatsApp

Invoice and order messages use WhatsApp share links (`wa.me/918160373047`).

## Mobile App

```bash
npm run cap:sync      # Build + sync Android/iOS
npm run cap:open:android
```

See [MOBILE.md](./MOBILE.md) for Capacitor details.

## Environment

Same as storefront:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Storage bucket `erp-documents` for purchase invoices and expense receipts (private; staff RLS).

## Architecture

```
src/
  services/erp/     # Data layer (Supabase client)
  types/erp.ts      # ERP TypeScript types
  components/erp/ # Barcode, POS receipt
  app/admin/        # ERP admin pages
  utils/gst.ts      # CGST/SGST/IGST helpers
```

No Next.js API routes — client → Supabase with RLS.

## Deployment

- **Web**: Vercel (`npm run build`)
- **Database**: Supabase (run migration 007)
- **Mobile**: Capacitor static export (`npm run build:mobile`)

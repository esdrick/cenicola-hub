-- Enable Row-Level Security on all public tables.
-- Prisma connects as the table owner (superuser) so it bypasses RLS automatically.
-- This only blocks direct access via Supabase's REST API (anon/authenticated roles).

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_shipments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_receivable  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll              ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_payable     ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items           ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- MASTER SCHEMA REPAIR & INITIALIZATION
-- ==========================================================
-- This script resets and re-creates the entire database schema
-- to ensure compatibility between types (Text vs UUID) 
-- and adds all missing tables for full system functionality.
-- ==========================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables in order to respect FK constraints
DROP TABLE IF EXISTS inventory_transfers CASCADE;
DROP TABLE IF EXISTS inventory_audits CASCADE;
DROP TABLE IF EXISTS supplier_orders CASCADE;
DROP TABLE IF EXISTS salary_settlements CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS time_shifts CASCADE;
DROP TABLE IF EXISTS returns CASCADE;
DROP TABLE IF EXISTS warranties CASCADE;
DROP TABLE IF EXISTS idn_settlement_prices CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS inventory_levels CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS cash_sessions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS bank_transactions CASCADE;
DROP TABLE IF EXISTS bank_cards CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS pending_order_items CASCADE;
DROP TABLE IF EXISTS pending_orders CASCADE;

-- 1. Branches
CREATE TABLE branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_main BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Categories
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    description TEXT,
    color TEXT,
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Products
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    cost_price NUMERIC NOT NULL DEFAULT 0,
    price NUMERIC NOT NULL DEFAULT 0,
    margin NUMERIC NOT NULL DEFAULT 0,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    color TEXT,
    commission_value NUMERIC DEFAULT 0,
    unit TEXT,
    status TEXT DEFAULT 'active',
    min_stock_alert INTEGER,
    has_serial BOOLEAN DEFAULT false,
    is_kit BOOLEAN DEFAULT false,
    kit_items JSONB DEFAULT '[]'::jsonb,
    warranty_days INTEGER,
    device_color TEXT,
    available_sizes JSONB,
    available_colors JSONB,
    next_serial INTEGER,
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'employee',
    password TEXT,
    base_salary NUMERIC NOT NULL DEFAULT 0,
    sales_goal NUMERIC DEFAULT 0,
    phone TEXT,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    supervisor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    allowed_branches TEXT[] DEFAULT '{}',
    permissions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_independent BOOLEAN DEFAULT false,
    assigned_branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Inventory
CREATE TABLE inventory (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    variant_label TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_id, branch_id, variant_label)
);

-- 6. Customers
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    tax_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Cash Sessions
CREATE TABLE cash_sessions (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    opening_balance NUMERIC NOT NULL DEFAULT 0,
    expected_balance NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    worker_name TEXT,
    working_employee_ids TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Transactions
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    seller_employee_ids TEXT[] DEFAULT '{}',
    cashier_name TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    subtotal NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    payments JSONB DEFAULT '[]',
    items JSONB DEFAULT '[]',
    status TEXT DEFAULT 'completed',
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    ncf TEXT,
    ncf_type TEXT,
    change_given NUMERIC DEFAULT 0,
    change_payments JSONB DEFAULT '[]',
    session_id TEXT REFERENCES cash_sessions(id) ON DELETE SET NULL,
    notes TEXT,
    payment_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. IDN Settlement Prices
CREATE TABLE idn_settlement_prices (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    settlement_price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, product_id)
);

-- 10. Inventory Transfers
CREATE TABLE inventory_transfers (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    product_name TEXT,
    from_branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    from_branch_name TEXT,
    to_branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    to_branch_name TEXT,
    variant_label TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    variants JSONB DEFAULT '[]',
    date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Warranties
CREATE TABLE warranties (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    product_name TEXT,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    serial_number TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Returns
CREATE TABLE returns (
    id TEXT PRIMARY KEY,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'pending',
    type TEXT DEFAULT 'refund',
    notes TEXT,
    variant_label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Quotes
CREATE TABLE quotes (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    subtotal NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    items JSONB DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. Time Shifts
CREATE TABLE time_shifts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    clock_in TIMESTAMP WITH TIME ZONE DEFAULT now(),
    clock_out TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. Bank Cards
CREATE TABLE bank_cards (
    id TEXT PRIMARY KEY,
    name TEXT,
    bank TEXT,
    bank_name TEXT,
    card_holder TEXT,
    account_number TEXT,
    phone TEXT,
    last_four_digits TEXT,
    balance NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'CUP',
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. Bank Transactions
CREATE TABLE bank_transactions (
    id TEXT PRIMARY KEY,
    card_id TEXT REFERENCES bank_cards(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    reference TEXT,
    description TEXT,
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. Suppliers
CREATE TABLE suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    email TEXT,
    rating NUMERIC DEFAULT 0,
    type_of_merchandise TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. Supplier Orders
CREATE TABLE supplier_orders (
    id TEXT PRIMARY KEY,
    supplier_id TEXT REFERENCES suppliers(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expected_delivery_date TIMESTAMP WITH TIME ZONE,
    items JSONB DEFAULT '[]',
    total NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    transport_details TEXT,
    transport_cost NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 19. Inventory Audits
CREATE TABLE inventory_audits (
    id TEXT PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    items JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 20. Salary Settlements
CREATE TABLE salary_settlements (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT,
    session_id TEXT REFERENCES cash_sessions(id) ON DELETE SET NULL,
    base_salary NUMERIC DEFAULT 0,
    sales_goal NUMERIC DEFAULT 0,
    commissions NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 21. Pending Orders
CREATE TABLE pending_orders (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    customer_name TEXT,
    table_number TEXT,
    status TEXT DEFAULT 'pending',
    total NUMERIC NOT NULL DEFAULT 0,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax NUMERIC NOT NULL DEFAULT 0,
    date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 22. Pending Order Items
CREATE TABLE pending_order_items (
    id TEXT PRIMARY KEY,
    pending_order_id TEXT REFERENCES pending_orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    variant_label TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================
-- For simplicity in this build environment, we enable public 
-- access for authenticated users or just all access if testing.
-- ==========================================================

-- Enable RLS for all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE idn_settlement_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_settlements ENABLE ROW LEVEL SECURITY;

-- Create Policies (Universal Access for Prototype)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public Full Access" ON %I', t);
        EXECUTE format('CREATE POLICY "Public Full Access" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- ==========================================================
-- INITIAL ADMIN SEED
-- ==========================================================
-- Only run if the system is completely empty
-- ==========================================================
INSERT INTO branches (id, name, address, is_main, is_active)
VALUES ('main-branch', 'Sucursal Principal', 'Dirección Principal', true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, email, role, password, is_active)
VALUES ('admin-1', 'Administrador', 'cristianmarco2003@gmail.com', 'admin', '03111166702', true)
ON CONFLICT (id) DO NOTHING;

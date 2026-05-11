create table if not exists business_profiles (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  representative_name text not null,
  business_registration_number text,
  phone text,
  address text,
  email text,
  business_type text,
  business_item text,
  bank_name text,
  bank_account text,
  account_holder text,
  seal_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manager text,
  phone text,
  address text,
  default_commission_rate numeric not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  spec text,
  unit text,
  retail_price integer not null default 0,
  default_commission_rate numeric not null default 0,
  default_supply_price integer not null default 0,
  price_mode text not null default 'auto' check (price_mode in ('auto', 'manual')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists statements (
  id uuid primary key default gen_random_uuid(),
  statement_no text not null,
  customer_id uuid references customers(id) on delete set null,
  issue_date date not null,
  delivery_date date not null,
  business_name text not null,
  representative_name text not null,
  business_registration_number text,
  supplier_phone text,
  supplier_address text,
  supplier_email text,
  business_type text,
  business_item text,
  bank_name text,
  bank_account text,
  account_holder text,
  seal_image_url text,
  show_seal boolean not null default true,
  show_price_details boolean not null default false,
  subtotal integer not null default 0,
  vat integer not null default 0,
  total integer not null default 0,
  vat_mode text not null default 'none' check (vat_mode in ('none', 'inclusive', 'exclusive')),
  memo text,
  pdf_url text,
  jpg_url text,
  status text not null default 'draft' check (status in ('draft', 'generated', 'sent')),
  sent_at timestamptz,
  sent_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists statement_items (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references statements(id) on delete cascade,
  product_name text not null,
  spec text,
  unit text,
  retail_price integer not null default 0,
  commission_rate numeric not null default 0,
  commission_amount integer not null default 0,
  price_mode text not null default 'auto' check (price_mode in ('auto', 'manual')),
  supply_unit_price integer not null default 0,
  quantity numeric not null default 0,
  retail_total integer not null default 0,
  supply_total integer not null default 0,
  amount integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists statements_issue_date_idx on statements(issue_date);
create index if not exists statements_customer_id_idx on statements(customer_id);
create index if not exists statements_status_idx on statements(status);
create index if not exists customers_name_idx on customers(name);
create index if not exists products_name_idx on products(name);

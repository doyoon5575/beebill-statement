create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manager text,
  phone text,
  address text,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  spec text,
  default_price integer not null default 0,
  unit text,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists statements (
  id uuid primary key default gen_random_uuid(),
  statement_no text not null,
  customer_id uuid references customers(id) on delete set null,
  issue_date date not null,
  delivery_date date not null,
  subtotal integer not null default 0,
  vat integer not null default 0,
  total integer not null default 0,
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
  quantity numeric not null default 0,
  unit text,
  unit_price integer not null default 0,
  amount integer not null default 0
);

create index if not exists statements_issue_date_idx on statements(issue_date);
create index if not exists statements_customer_id_idx on statements(customer_id);
create index if not exists customers_name_idx on customers(name);
create index if not exists products_name_idx on products(name);

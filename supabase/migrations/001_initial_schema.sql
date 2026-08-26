create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  full_name text not null,
  role text not null check (role in ('admin','operator')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vehicle_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  vehicle_type_id uuid not null references vehicle_types(id),
  plate text not null unique,
  brand text,
  model text,
  model_year integer,
  color text,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true
);

create table if not exists service_prices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  vehicle_type_id uuid not null references vehicle_types(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  unique(service_id, vehicle_type_id)
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  sale_number bigint generated always as identity unique,
  client_id uuid not null references clients(id),
  vehicle_id uuid not null references vehicles(id),
  total numeric(10,2) not null check (total >= 0),
  status text not null default 'confirmed'
    check (status in ('confirmed','correction_pending','corrected','voided')),
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  service_id uuid not null references services(id),
  service_name_snapshot text not null,
  price_applied numeric(10,2) not null check (price_applied >= 0),
  quantity integer not null default 1 check (quantity > 0),
  subtotal numeric(10,2) not null check (subtotal >= 0)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  method text not null check (method in ('cash','yape','plin','transfer','other')),
  amount numeric(10,2) not null check (amount >= 0),
  receipt_path text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  concept text not null,
  category text,
  supplier text,
  amount numeric(10,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','yape','plin','transfer','other')),
  receipt_path text,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('income','expense')),
  payment_method text not null check (payment_method in ('cash','yape','plin','transfer','other')),
  amount numeric(10,2) not null check (amount > 0),
  sale_id uuid references sales(id),
  expense_id uuid references expenses(id),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit_name text not null,
  stock numeric(12,3) not null default 0 check (stock >= 0),
  minimum_stock numeric(12,3) not null default 0 check (minimum_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  movement_type text not null check (movement_type in ('entry','exit','adjustment')),
  quantity numeric(12,3) not null check (quantity > 0),
  reason text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists workdays (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references profiles(id),
  work_date date not null,
  status text not null default 'open' check (status in ('open','closed')),
  notes text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists workday_events (
  id uuid primary key default gen_random_uuid(),
  workday_id uuid not null references workdays(id) on delete cascade,
  event_type text not null check (event_type in ('open','lunch','return','close')),
  occurred_at timestamptz not null default now(),
  photo_path text not null,
  reason text,
  notes text,
  created_by uuid not null references profiles(id)
);

create table if not exists correction_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  requested_by uuid not null references profiles(id),
  reason text not null,
  requested_changes jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

insert into vehicle_types(name, description) values
('Auto','Autos compactos y sedán'),
('Camioneta / SUV','Camionetas y SUV'),
('Camioneta XL','Pick-up grande y vehículos XL'),
('Otro','Vehículos especiales')
on conflict (name) do nothing;

insert into services(name) values
('Lavado exterior'),
('Lavado completo'),
('Aspirado'),
('Encerado'),
('Lavado de motor'),
('Pulido'),
('Detailing'),
('Ceramicado'),
('Otro servicio')
on conflict (name) do nothing;

create index if not exists idx_vehicles_plate on vehicles(plate);
create index if not exists idx_sales_vehicle_date on sales(vehicle_id, created_at desc);
create index if not exists idx_sales_client_date on sales(client_id, created_at desc);
create index if not exists idx_workday_events_workday on workday_events(workday_id, occurred_at);
create index if not exists idx_audit_entity on audit_log(entity_type, entity_id, created_at desc);

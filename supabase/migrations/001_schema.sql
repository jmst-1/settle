create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_currency text default 'SGD',
  default_paynow text,
  avatar_url text,
  preferred_lang text default 'en',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  avatar_url text,
  default_currency text default 'SGD',
  default_split_mode text default 'assign',
  is_personal boolean default false,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index groups_one_personal on groups (owner_id) where is_personal = true;

create table group_admins (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  granted_at timestamptz default now(),
  primary key (group_id, user_id)
);

create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  linked_user_id uuid references auth.users(id),
  name text not null,
  paynow text,
  paynow_type text default 'mobile',
  email text,
  phone text,
  share_token uuid default gen_random_uuid() unique,
  avatar_color text,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table receipt_inbox (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id),
  label text,
  image_url text,
  ocr_raw jsonb,
  processed boolean default false,
  bill_id uuid,
  captured_at timestamptz default now(),
  created_at timestamptz default now()
);

create table bills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id),
  group_id uuid references groups(id),
  occasion text,
  venue text,
  venue_lat numeric(9,6),
  venue_lng numeric(9,6),
  bill_date date default current_date,
  currency text default 'SGD',
  fx_rate numeric(12,6) default 1.0,
  subtotal numeric(10,2),
  discount numeric(10,2) default 0,
  discount_type text default 'amount',
  service_charge numeric(10,2) default 0,
  tax numeric(10,2) default 0,
  tax_label text default 'GST',
  rounding_adj numeric(10,2) default 0,
  total numeric(10,2),
  paid_by_member_id uuid references members(id),
  receipt_url text,
  receipt_raw_ocr jsonb,
  ocr_confidence numeric(5,2),
  notes text,
  status text default 'open',
  locked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table receipt_inbox
  add constraint receipt_inbox_bill_fk foreign key (bill_id) references bills(id);

create table bill_members (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills(id) on delete cascade,
  member_id uuid references members(id),
  name text not null,
  paynow text,
  share_token uuid default gen_random_uuid() unique,
  is_payer boolean default false,
  created_at timestamptz default now()
);

create table bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills(id) on delete cascade,
  name text not null,
  category text,
  unit_price numeric(10,2) not null,
  quantity int default 1,
  total_price numeric(10,2) generated always as (unit_price * quantity) stored,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table bill_item_assignments (
  id uuid primary key default gen_random_uuid(),
  bill_item_id uuid references bill_items(id) on delete cascade,
  bill_member_id uuid references bill_members(id) on delete cascade,
  share numeric(10,6) not null,
  constraint share_positive check (share > 0),
  constraint share_max check (share <= 1)
);

create table bill_debts (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills(id) on delete cascade,
  debtor_bill_member_id uuid references bill_members(id),
  creditor_bill_member_id uuid references bill_members(id),
  subtotal_share numeric(10,2),
  discount_share numeric(10,2) default 0,
  sc_share numeric(10,2) default 0,
  tax_share numeric(10,2) default 0,
  total_amount numeric(10,2),
  settled boolean default false,
  settled_at timestamptz,
  created_at timestamptz default now(),
  constraint no_self_debt check (debtor_bill_member_id != creditor_bill_member_id)
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id),
  from_member_id uuid references members(id) not null,
  to_member_id uuid references members(id) not null,
  amount numeric(10,2) not null,
  currency text default 'SGD',
  method text,
  reference_no text,
  note text,
  confirmed_by_creditor boolean default false,
  settled_at timestamptz,
  settled boolean default false,
  covered_debt_ids uuid[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint no_self_settlement check (from_member_id != to_member_id),
  constraint positive_amount check (amount > 0)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_member_id uuid references members(id),
  recipient_user_id uuid references auth.users(id),
  type text,
  payload jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  channel text,
  created_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  actor_token uuid,
  entity_type text,
  entity_id uuid,
  action text,
  diff jsonb,
  created_at timestamptz default now()
);

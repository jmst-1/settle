create table gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  refresh_token_enc text not null,
  history_id text,
  watch_expiration timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table alert_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  amount_threshold numeric(10,2) not null default 30,
  dining_only boolean not null default true,
  email_back boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table card_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  gmail_message_id text not null,
  merchant text not null,
  merchant_norm text not null,
  amount numeric(10,2) not null,
  currency text not null default 'SGD',
  txn_date date not null,
  category text not null default 'other',
  confidence numeric(4,3) not null default 0,
  source_from text,
  status text not null default 'pending',
  matched_bill_id uuid references bills(id) on delete set null,
  created_at timestamptz default now(),
  constraint card_transactions_status check (status in ('pending', 'dismissed', 'converted', 'matched')),
  constraint card_transactions_category check (category in ('dining', 'other')),
  constraint card_transactions_amount check (amount >= 0)
);

create unique index card_transactions_owner_message
  on card_transactions (owner_id, gmail_message_id);

create index card_transactions_owner_status
  on card_transactions (owner_id, status, created_at desc);

create table merchant_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  merchant_norm text not null,
  rule text not null default 'always_prompt',
  dismiss_count int not null default 0,
  confirm_count int not null default 0,
  updated_at timestamptz default now(),
  constraint merchant_rules_kind check (rule in ('never_split', 'always_prompt')),
  constraint merchant_rules_unique unique (owner_id, merchant_norm)
);

alter table gmail_connections enable row level security;
alter table alert_settings enable row level security;
alter table card_transactions enable row level security;
alter table merchant_rules enable row level security;

create policy "own_gmail_connections" on gmail_connections for all using (user_id = auth.uid());
create policy "own_alert_settings" on alert_settings for all using (user_id = auth.uid());
create policy "own_card_transactions" on card_transactions for all using (owner_id = auth.uid());
create policy "own_merchant_rules" on merchant_rules for all using (owner_id = auth.uid());

create table payee_pairs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  member_a text not null,
  member_b text not null,
  settler text not null,
  created_at timestamptz default now(),
  constraint payee_pairs_two_people check (member_a <> member_b),
  constraint payee_pairs_settler check (settler = member_a or settler = member_b)
);

create unique index payee_pairs_owner_pair
  on payee_pairs (owner_id, least(member_a, member_b), greatest(member_a, member_b));

alter table payee_pairs enable row level security;

create policy "owner_payee_pairs" on payee_pairs for all using (owner_id = auth.uid());

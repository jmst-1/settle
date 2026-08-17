alter table user_profiles enable row level security;
alter table groups enable row level security;
alter table group_admins enable row level security;
alter table members enable row level security;
alter table bills enable row level security;
alter table bill_members enable row level security;
alter table bill_items enable row level security;
alter table bill_item_assignments enable row level security;
alter table bill_debts enable row level security;
alter table settlements enable row level security;
alter table receipt_inbox enable row level security;
alter table notifications enable row level security;

create policy "own_profile" on user_profiles for all using (id = auth.uid());

create policy "owner_groups" on groups for all using (owner_id = auth.uid());

create policy "owner_members" on members for all using (
  exists (select 1 from groups g where g.id = members.group_id and g.owner_id = auth.uid())
);

create policy "owner_bills" on bills for all using (owner_id = auth.uid());

create policy "participant_bills_select" on bills for select using (
  exists (
    select 1 from bill_members bm
    join members m on m.id = bm.member_id
    where bm.bill_id = bills.id and m.linked_user_id = auth.uid()
  )
);

create policy "owner_inbox" on receipt_inbox for all using (owner_id = auth.uid());

create policy "bill_children_owner" on bill_members for all using (
  exists (select 1 from bills b where b.id = bill_members.bill_id and b.owner_id = auth.uid())
);

create policy "bill_items_owner" on bill_items for all using (
  exists (select 1 from bills b where b.id = bill_items.bill_id and b.owner_id = auth.uid())
);

create policy "bill_assign_owner" on bill_item_assignments for all using (
  exists (
    select 1 from bill_items i
    join bills b on b.id = i.bill_id
    where i.id = bill_item_assignments.bill_item_id and b.owner_id = auth.uid()
  )
);

create policy "bill_debts_owner" on bill_debts for all using (
  exists (select 1 from bills b where b.id = bill_debts.bill_id and b.owner_id = auth.uid())
);

create policy "settlements_owner" on settlements for all using (
  exists (select 1 from groups g where g.id = settlements.group_id and g.owner_id = auth.uid())
);

create policy "notifications_recipient" on notifications for all using (
  recipient_user_id = auth.uid()
);

-- Storage: create bucket in dashboard or via SQL
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_owner" on storage.objects for all using (
  bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
);

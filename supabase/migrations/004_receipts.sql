alter table bills add column if not exists receipts jsonb;
alter table bill_items add column if not exists receipt_id text;

# SplitTab

Mobile-first expense splitting. Friends don't need an account — each person gets a permanent `/settle/[token]` link (unguessable id, not their name).

This branch is a **UI mockup** with local seed data (no Supabase, no Claude OCR).

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The layout is phone-width.

The **Me** bar switches the full app (bills, inbox, new bill, settle) into each person's me-centric view. Alice is the super user. **Pay** is still the QR-first portal for that person's unique token.

## What's in the mockup

- Me-centric home: you owe / you're owed, bills you're on (Alice also sees every tab)
- Anyone can add an expense; people chips are **that creator's roster**
- Settle nets **per creator** — Alice's Bob is not Dana's Bob
- Creator or the people on a debt can tag paid; only Alice can undo
- Personal inbox, unique settle tokens, pay portal + "Open my bills"

Seed bills: Handlebar (Alice's tab), PS.Cafe (Bob's tab), Atlas Bar (Con's tab).

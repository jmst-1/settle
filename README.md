# SplitTab

Singapore-first, mobile-first expense splitter. Friends don’t need an account — each person gets a permanent `/settle/[token]` link, pays via PayNow, and taps **I’ve paid**.

## Product

- **Me-centric app:** you see bills you’re on, your inbox, your roster, your settle.
- A bill belongs to a **creator tab**. Alice’s Bob is not Dana’s Bob until an explicit merge later.
- Home is **You owe / You’re owed**. Settle nets **per creator tab**.
- **Tag paid:** tab creator or someone on that debt. **Undo:** tab creator only.
- Portal shows **raw** debts and is one-direction self-certify. No amounts in crawler OG tags.
- SGD + PayNow only. No dark mode in v1.

## Run

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Layout is phone-width.

Without Supabase keys the API uses an in-memory store (seeded Handlebar / PS.Cafe / Atlas). Sign in with any email (try `alice@example.com`). Production uses magic link when `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_SERVICE_ROLE_KEY` are set.

OCR: upload a receipt photo, then `POST /api/ocr { path }`. Needs `ANTHROPIC_API_KEY`. HEIC is converted with `sharp`. You can always enter a bill manually.

```bash
npm test
npm run build
```

## Schema

Apply `supabase/migrations/*.sql` in the Supabase SQL editor (or CLI). That creates tables, RLS, the `receipts` storage bucket, and a Personal group per user as their roster.

## Stack

Next.js 14 App Router, TypeScript, Tailwind, Supabase, Claude vision OCR, PWA.

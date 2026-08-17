# SplitTab

Mobile-first expense splitting. Friends don't need an account — each person gets a permanent `/settle/[token]` link, pays via PayNow QR, and taps I've paid.

This branch is a **UI mockup** with local seed data (no Supabase, no Claude OCR). Use it to click through the owner app and the participant portal before Phase 0–6 wiring.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The layout is phone-width. A **Mock** bar at the top switches between the owner app and Dana / Bob / Con / Alice settle links.

## What's in the mockup

- Owner: bills, inbox, settle up, new-bill wizard (scan → review → people → split)
- Link-first share (WhatsApp-style message), PNG card as secondary
- Participant portal: QR hero, confirm I've paid, all-clear + bookmark hint
- Confirm + owner undo for settlements
- Recent-people chips, You pre-selected, 16px inputs, Lucide icons

Seed bills are Handlebar, PS.Cafe, and Atlas Bar from the original prototype.

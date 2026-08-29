import type { Bill } from "@/lib/types";
import { merchantSimilarity } from "@/lib/alerts/normalize";

export type BillMatch = {
  billId: string;
  score: number;
  merchant: number;
  amount: number;
  date: number;
  confidence: "high" | "medium";
};

function daysApart(a: string, b: string): number {
  const da = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const db = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return 99;
  return Math.abs(da - db) / 86_400_000;
}

function amountScore(billTotal: number, txnAmount: number): number {
  const delta = Math.abs(billTotal - txnAmount);
  const pct = txnAmount > 0 ? delta / txnAmount : 1;
  if (delta <= 2 || pct <= 0.05) return 1;
  if (pct <= 0.1) return 0.55;
  return 0;
}

function dateScore(billDate: string, txnDate: string): number {
  const days = daysApart(billDate, txnDate);
  if (days <= 0.5) return 1;
  if (days <= 1.5) return 0.7;
  return 0;
}

export function matchBills(
  bills: Pick<Bill, "id" | "occasion" | "billDate" | "receiptTotal" | "createdBy">[],
  input: { merchant: string; amount: number; date: string; ownerId: string },
): BillMatch | null {
  let best: BillMatch | null = null;
  for (const bill of bills) {
    if (bill.createdBy !== input.ownerId) continue;
    const date = dateScore(bill.billDate, input.date);
    const amount = amountScore(bill.receiptTotal, input.amount);
    if (date <= 0 || amount <= 0) continue;
    const merchant = merchantSimilarity(bill.occasion, input.merchant);
    const score = date * amount * Math.max(merchant, 0.15);
    const confidence: "high" | "medium" =
      merchant >= 0.6 && score >= 0.55 ? "high" : "medium";
    if (confidence === "medium" && merchant < 0.25 && amount < 1) continue;
    if (!best || score > best.score) {
      best = { billId: bill.id, score, merchant, amount, date, confidence };
    }
  }
  if (!best) return null;
  if (best.confidence === "medium" && best.score < 0.35) return null;
  return best;
}

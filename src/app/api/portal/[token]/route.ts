import { NextResponse } from "next/server";
import { foldDebtsForPairs, personTotals } from "@/lib/debts";
import {
  creatorName,
  expandPairNames,
  pairContaining,
  pairsForCreator,
  partnerName,
  paynowForContact,
} from "@/lib/me";
import { portalPayload } from "@/lib/data/repo";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const payload = await portalPayload(params.token);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, bills, users, contacts, linkedUserId, creatorId, pairs = [] } = payload;
  type Creditor = {
    key: string;
    creatorId: string;
    creditor: string;
    amount: number;
    paynow: string;
    settler: string | null;
    partner: string | null;
    bills: {
      id: string;
      occasion: string;
      date: string;
      amount: number;
      items: { name: string; amount: number; isShared: boolean }[];
      discount: number;
      sc: number;
      tax: number;
    }[];
  };
  const map = new Map<string, Creditor>();

  for (const bill of bills) {
    const myNames = expandPairNames(pairs, bill.createdBy, name);
    const debts = bill.debts.filter((d) => myNames.includes(d.from) && !d.settled);
    if (!debts.length) continue;
    const creatorPairs = pairsForCreator(pairs, bill.createdBy);
    const folded = foldDebtsForPairs(debts, creatorPairs);
    const totals = personTotals(bill);
    const mergedItems = myNames.flatMap((n) =>
      (totals[n]?.items ?? []).map((it) => ({
        name: it.name,
        amount: it.amount,
        isShared: it.isShared,
      })),
    );
    const mergedDiscount = myNames.reduce((s, n) => s + (totals[n]?.discount ?? 0), 0);
    const mergedSc = myNames.reduce((s, n) => s + (totals[n]?.sc ?? 0), 0);
    const mergedTax = myNames.reduce((s, n) => s + (totals[n]?.tax ?? 0), 0);
    const pair = pairContaining(pairs, bill.createdBy, name);

    for (const d of folded) {
      const key = `${bill.createdBy}::${d.to}`;
      const cur = map.get(key) ?? {
        key,
        creatorId: bill.createdBy,
        creditor: d.to,
        amount: 0,
        paynow: paynowForContact(contacts, users, d.to, bill.createdBy),
        settler: pair && pair.memberNames.includes(name) ? pair.settler : null,
        partner: pair && pair.memberNames.includes(name) ? partnerName(pair, pair.settler) : null,
        bills: [],
      };
      cur.amount += d.amount;
      cur.bills.push({
        id: bill.id,
        occasion: bill.occasion,
        date: bill.billDate,
        amount: d.amount,
        items: mergedItems,
        discount: mergedDiscount,
        sc: mergedSc,
        tax: mergedTax,
      });
      map.set(key, cur);
    }
  }

  return NextResponse.json({
    token: params.token,
    name,
    linkedUserId,
    creatorId,
    creatorLabel: creatorId ? creatorName(users, creatorId) : null,
    creditors: Array.from(map.values()),
  });
}

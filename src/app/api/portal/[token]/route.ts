import { NextResponse } from "next/server";
import { personTotals } from "@/lib/debts";
import { creatorName, paynowForContact } from "@/lib/me";
import { portalPayload } from "@/lib/data/repo";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const payload = await portalPayload(params.token);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, bills, users, contacts, linkedUserId, creatorId } = payload;
  type Creditor = {
    key: string;
    creatorId: string;
    creditor: string;
    amount: number;
    paynow: string;
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
    const debts = bill.debts.filter((d) => d.from === name && !d.settled);
    if (!debts.length) continue;
    const totals = personTotals(bill);
    const mine = totals[name];
    for (const d of debts) {
      const key = `${bill.createdBy}::${d.to}`;
      const cur = map.get(key) ?? {
        key,
        creatorId: bill.createdBy,
        creditor: d.to,
        amount: 0,
        paynow: paynowForContact(contacts, users, d.to, bill.createdBy),
        bills: [],
      };
      cur.amount += d.amount;
      cur.bills.push({
        id: bill.id,
        occasion: bill.occasion,
        date: bill.billDate,
        amount: d.amount,
        items: mine?.items ?? [],
        discount: mine?.discount ?? 0,
        sc: mine?.sc ?? 0,
        tax: mine?.tax ?? 0,
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

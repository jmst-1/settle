import type { BillDebt, BillItem, PayeePair } from "@/lib/types";

export function computeDebts(
  items: BillItem[],
  names: string[],
  paidBy: string,
  discount: number,
  serviceCharge: number,
  tax: number,
): BillDebt[] {
  const itemSubtotal = items.reduce((sum, item) => sum + item.price, 0);
  const totals: Record<string, number> = {};
  names.forEach((name) => {
    totals[name] = 0;
  });

  for (const item of items) {
    const share =
      item.split && item.splitWith.length
        ? item.splitWith
        : item.assignee
          ? [item.assignee]
          : [];
    const perPerson = share.length ? item.price / share.length : 0;
    for (const name of share) {
      if (totals[name] !== undefined) totals[name] += perPerson;
    }
  }

  const debts: BillDebt[] = [];
  for (const name of names) {
    if (name === paidBy) continue;
    const ratio = itemSubtotal > 0 ? totals[name] / itemSubtotal : 0;
    const personTotal =
      totals[name] - discount * ratio + serviceCharge * ratio + tax * ratio;
    if (personTotal > 0.005) {
      debts.push({
        from: name,
        to: paidBy,
        amount: parseFloat(personTotal.toFixed(2)),
        settled: false,
      });
    }
  }
  return debts;
}

/** Rewrite pair partners to their settler, drop internal debts, sum the rest. */
export function foldDebtsForPairs<T extends { from: string; to: string; amount: number }>(
  debts: T[],
  pairs: PayeePair[],
): T[] {
  if (!pairs.length) return debts;

  const alias = new Map<string, string>();
  for (const pair of pairs) {
    for (const name of pair.memberNames) {
      if (name !== pair.settler) alias.set(name, pair.settler);
    }
  }
  const rewrite = (name: string) => alias.get(name) ?? name;

  const summed = new Map<string, T>();
  for (const debt of debts) {
    const from = rewrite(debt.from);
    const to = rewrite(debt.to);
    if (from === to) continue;
    const settledKey = "settled" in debt ? String((debt as { settled?: boolean }).settled) : "";
    const key = `${from}||${to}||${settledKey}`;
    const existing = summed.get(key);
    if (existing) {
      existing.amount = parseFloat((existing.amount + debt.amount).toFixed(2));
    } else {
      summed.set(key, { ...debt, from, to, amount: debt.amount });
    }
  }
  return Array.from(summed.values()).filter((d) => Math.abs(d.amount) > 0.005);
}

export function isInternalPairDebt(
  from: string,
  to: string,
  pairs: PayeePair[],
) {
  for (const pair of pairs) {
    const members = pair.memberNames;
    if (members.includes(from) && members.includes(to) && from !== to) return true;
  }
  return false;
}

export function simplifyDebts(rawDebts: BillDebt[]) {
  const net: Record<string, number> = {};
  for (const { from, to, amount } of rawDebts) {
    net[from] = (net[from] || 0) - amount;
    net[to] = (net[to] || 0) + amount;
  }

  const pos: { person: string; bal: number }[] = [];
  const neg: { person: string; bal: number }[] = [];
  for (const [person, bal] of Object.entries(net)) {
    if (bal > 0.005) pos.push({ person, bal });
    if (bal < -0.005) neg.push({ person, bal: -bal });
  }

  const txns: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < pos.length && j < neg.length) {
    const amt = Math.min(pos[i].bal, neg[j].bal);
    txns.push({
      from: neg[j].person,
      to: pos[i].person,
      amount: parseFloat(amt.toFixed(2)),
    });
    pos[i].bal -= amt;
    neg[j].bal -= amt;
    if (pos[i].bal < 0.005) i += 1;
    if (neg[j].bal < 0.005) j += 1;
  }
  return txns;
}

export function personTotals(bill: {
  items: BillItem[];
  names: string[];
  discount: number;
  serviceCharge: number;
  tax: number;
}) {
  const itemSubtotal = bill.items.reduce((sum, item) => sum + item.price, 0);
  const totals: Record<
    string,
    {
      items: { name: string; amount: number; isShared: boolean; splitWith: string[] }[];
      subtotal: number;
      discount: number;
      sc: number;
      tax: number;
      total: number;
    }
  > = {};

  bill.names.forEach((name) => {
    totals[name] = { items: [], subtotal: 0, discount: 0, sc: 0, tax: 0, total: 0 };
  });

  for (const item of bill.items) {
    const share =
      item.split && item.splitWith.length
        ? item.splitWith
        : item.assignee
          ? [item.assignee]
          : [];
    const perPerson = share.length ? item.price / share.length : 0;
    for (const name of share) {
      if (!totals[name]) continue;
      totals[name].items.push({
        name: item.name,
        amount: perPerson,
        isShared: item.split,
        splitWith: item.splitWith || [],
      });
      totals[name].subtotal += perPerson;
    }
  }

  for (const name of bill.names) {
    const ratio = itemSubtotal > 0 ? totals[name].subtotal / itemSubtotal : 0;
    totals[name].discount = (bill.discount || 0) * ratio;
    totals[name].sc = (bill.serviceCharge || 0) * ratio;
    totals[name].tax = (bill.tax || 0) * ratio;
    totals[name].total =
      totals[name].subtotal - totals[name].discount + totals[name].sc + totals[name].tax;
  }

  return totals;
}

import type { BillDebt, BillItem } from "@/lib/types";

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
  return roundCents(
    debts,
    items,
    names,
    paidBy,
    discount,
    serviceCharge,
    tax,
    items.reduce((sum, item) => sum + item.price, 0) - discount + serviceCharge + tax,
  );
}

/** Assign leftover cents to the largest debt so person totals match the bill. */
export function roundCents(
  debts: BillDebt[],
  items: BillItem[],
  names: string[],
  paidBy: string,
  discount: number,
  serviceCharge: number,
  tax: number,
  receiptTotal: number,
): BillDebt[] {
  if (!debts.length) return debts;
  const totals = personTotals({ items, names, discount, serviceCharge, tax });
  const payerShare = totals[paidBy]?.total ?? 0;
  const expected = parseFloat((receiptTotal - payerShare).toFixed(2));
  const sum = debts.reduce((s, d) => s + d.amount, 0);
  const diff = parseFloat((expected - sum).toFixed(2));
  if (Math.abs(diff) < 0.005) return debts;
  let idx = 0;
  debts.forEach((d, i) => {
    if (d.amount > debts[idx].amount) idx = i;
  });
  return debts.map((d, i) =>
    i === idx ? { ...d, amount: parseFloat((d.amount + diff).toFixed(2)) } : d,
  );
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

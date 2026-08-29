import type { BillDebt, BillItem, BillReceipt, PayeePair } from "@/lib/types";

function itemShare(item: BillItem): string[] {
  return item.split && item.splitWith.length
    ? item.splitWith
    : item.assignee
      ? [item.assignee]
      : [];
}

function allocateSection(
  items: BillItem[],
  names: string[],
  discount: number,
  serviceCharge: number,
  tax: number,
): Record<string, { subtotal: number; discount: number; sc: number; tax: number; total: number }> {
  const itemSubtotal = items.reduce((sum, item) => sum + item.price, 0);
  const subtotals: Record<string, number> = {};
  names.forEach((name) => {
    subtotals[name] = 0;
  });

  for (const item of items) {
    const share = itemShare(item);
    const perPerson = share.length ? item.price / share.length : 0;
    for (const name of share) {
      if (subtotals[name] !== undefined) subtotals[name] += perPerson;
    }
  }

  const result: Record<
    string,
    { subtotal: number; discount: number; sc: number; tax: number; total: number }
  > = {};
  for (const name of names) {
    const ratio = itemSubtotal > 0 ? subtotals[name] / itemSubtotal : 0;
    const disc = discount * ratio;
    const sc = serviceCharge * ratio;
    const gst = tax * ratio;
    result[name] = {
      subtotal: subtotals[name],
      discount: disc,
      sc,
      tax: gst,
      total: subtotals[name] - disc + sc + gst,
    };
  }
  return result;
}

function sectionsFor(
  items: BillItem[],
  discount: number,
  serviceCharge: number,
  tax: number,
  receipts?: BillReceipt[],
): { items: BillItem[]; discount: number; serviceCharge: number; tax: number }[] {
  if (!receipts?.length) {
    return [{ items, discount, serviceCharge, tax }];
  }
  const known = new Set(receipts.map((r) => r.id));
  const sections = receipts.map((receipt) => ({
    items: items.filter((it) => it.receiptId === receipt.id),
    discount: receipt.discount,
    serviceCharge: receipt.serviceCharge,
    tax: receipt.tax,
  }));
  const orphans = items.filter((it) => !it.receiptId || !known.has(it.receiptId));
  if (orphans.length) {
    sections.push({ items: orphans, discount: 0, serviceCharge: 0, tax: 0 });
  }
  return sections;
}

export function computeDebts(
  items: BillItem[],
  names: string[],
  paidBy: string,
  discount: number,
  serviceCharge: number,
  tax: number,
  receipts?: BillReceipt[],
): BillDebt[] {
  const totals: Record<string, number> = {};
  names.forEach((name) => {
    totals[name] = 0;
  });

  for (const section of sectionsFor(items, discount, serviceCharge, tax, receipts)) {
    const allocated = allocateSection(
      section.items,
      names,
      section.discount,
      section.serviceCharge,
      section.tax,
    );
    for (const name of names) {
      totals[name] += allocated[name].total;
    }
  }

  const debts: BillDebt[] = [];
  for (const name of names) {
    if (name === paidBy) continue;
    if (totals[name] > 0.005) {
      debts.push({
        from: name,
        to: paidBy,
        amount: parseFloat(totals[name].toFixed(2)),
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
    receipts,
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
  receipts?: BillReceipt[],
): BillDebt[] {
  if (!debts.length) return debts;
  const totals = personTotals({ items, names, discount, serviceCharge, tax, receipts });
  const payerShare = totals[paidBy]?.total ?? 0;
  const grand = receipts?.length
    ? names.reduce((s, n) => s + (totals[n]?.total ?? 0), 0)
    : receiptTotal;
  const expected = parseFloat((grand - payerShare).toFixed(2));
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
  receipts?: BillReceipt[];
}) {
  const receiptLabel = (receiptId?: string) => {
    if (!bill.receipts || bill.receipts.length < 2 || !receiptId) return undefined;
    return bill.receipts.find((r) => r.id === receiptId)?.label;
  };

  const totals: Record<
    string,
    {
      items: {
        name: string;
        amount: number;
        isShared: boolean;
        splitWith: string[];
        receiptLabel?: string;
      }[];
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
    const share = itemShare(item);
    const perPerson = share.length ? item.price / share.length : 0;
    const label = receiptLabel(item.receiptId);
    for (const name of share) {
      if (!totals[name]) continue;
      totals[name].items.push({
        name: item.name,
        amount: perPerson,
        isShared: item.split,
        splitWith: item.splitWith || [],
        receiptLabel: label,
      });
    }
  }

  for (const section of sectionsFor(
    bill.items,
    bill.discount,
    bill.serviceCharge,
    bill.tax,
    bill.receipts,
  )) {
    const allocated = allocateSection(
      section.items,
      bill.names,
      section.discount,
      section.serviceCharge,
      section.tax,
    );
    for (const name of bill.names) {
      totals[name].subtotal += allocated[name].subtotal;
      totals[name].discount += allocated[name].discount;
      totals[name].sc += allocated[name].sc;
      totals[name].tax += allocated[name].tax;
      totals[name].total += allocated[name].total;
    }
  }

  return totals;
}

export function billSections(bill: {
  id: string;
  occasion: string;
  billDate: string;
  items: BillItem[];
  discount: number;
  serviceCharge: number;
  tax: number;
  receiptTotal: number;
  receipts?: BillReceipt[];
}): { receipt: BillReceipt; items: BillItem[] }[] {
  if (bill.receipts && bill.receipts.length > 0) {
    const known = new Set(bill.receipts.map((r) => r.id));
    const sections = bill.receipts.map((receipt) => ({
      receipt,
      items: bill.items.filter((it) => it.receiptId === receipt.id),
    }));
    const orphans = bill.items.filter((it) => !it.receiptId || !known.has(it.receiptId));
    if (orphans.length) {
      sections.push({
        receipt: {
          id: `${bill.id}-other`,
          label: "Other items",
          billDate: bill.billDate,
          discount: 0,
          serviceCharge: 0,
          tax: 0,
          receiptTotal: orphans.reduce((s, it) => s + it.price, 0),
        },
        items: orphans,
      });
    }
    return sections;
  }
  return [
    {
      receipt: {
        id: bill.id,
        label: bill.occasion,
        billDate: bill.billDate,
        discount: bill.discount,
        serviceCharge: bill.serviceCharge,
        tax: bill.tax,
        receiptTotal: bill.receiptTotal,
      },
      items: bill.items,
    },
  ];
}

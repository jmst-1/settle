import { describe, expect, it } from "vitest";
import { computeDebts, personTotals, roundCents, simplifyDebts } from "@/lib/debts";
import type { BillDebt, BillItem } from "@/lib/types";

const names = ["Alice", "Bob", "Con"];

function items(rows: [string, number, string[] | string][]): BillItem[] {
  return rows.map(([name, price, who]) =>
    Array.isArray(who)
      ? { name, price, assignee: null, split: true, splitWith: who }
      : { name, price, assignee: who, split: false, splitWith: [] },
  );
}

describe("computeDebts", () => {
  it("charges each person their share plus proportional GST", () => {
    const billItems = items([
      ["Burger", 30, "Alice"],
      ["Pasta", 20, "Bob"],
    ]);
    const debts = computeDebts(billItems, ["Alice", "Bob"], "Alice", 0, 0, 5);
    const bob = debts.find((d) => d.from === "Bob");
    expect(bob).toBeTruthy();
    expect(bob!.to).toBe("Alice");
    expect(bob!.amount).toBeCloseTo(22, 2);
    expect(bob!.settled).toBe(false);
  });

  it("returns no debts when the payer is the only person", () => {
    const debts = computeDebts(items([["Tea", 5, "Alice"]]), ["Alice"], "Alice", 0, 0, 0);
    expect(debts).toEqual([]);
  });

  it("allocates GST per slip when combining receipts", () => {
    const foodId = "r-food";
    const drinkId = "r-drink";
    const billItems: BillItem[] = [
      { name: "Burger", price: 30, assignee: "Alice", split: false, splitWith: [], receiptId: foodId },
      { name: "Martini", price: 20, assignee: "Bob", split: false, splitWith: [], receiptId: drinkId },
    ];
    const debts = computeDebts(
      billItems,
      ["Alice", "Bob"],
      "Alice",
      0,
      0,
      0,
      [
        {
          id: foodId,
          label: "Food",
          billDate: "2026-06-14",
          discount: 0,
          serviceCharge: 0,
          tax: 3,
          receiptTotal: 33,
        },
        {
          id: drinkId,
          label: "Drinks",
          billDate: "2026-06-14",
          discount: 0,
          serviceCharge: 0,
          tax: 2,
          receiptTotal: 22,
        },
      ],
    );
    const bob = debts.find((d) => d.from === "Bob");
    expect(bob?.amount).toBeCloseTo(22, 2);
  });
});

describe("roundCents", () => {
  it("assigns leftover cents to the largest debt", () => {
    const raw: BillDebt[] = [
      { from: "Bob", to: "Alice", amount: 10.33, settled: false },
      { from: "Con", to: "Alice", amount: 10.33, settled: false },
    ];
    const billItems = items([
      ["A", 10.33, "Bob"],
      ["B", 10.33, "Con"],
      ["C", 10.34, "Alice"],
    ]);
    const total = 31;
    const rounded = roundCents(raw, billItems, names, "Alice", 0, 0, 0, total);
    const sum = rounded.reduce((s, d) => s + d.amount, 0);
    const totals = personTotals({ items: billItems, names, discount: 0, serviceCharge: 0, tax: 0 });
    const expected = parseFloat((total - totals.Alice.total).toFixed(2));
    expect(sum).toBeCloseTo(expected, 2);
  });
});

describe("simplifyDebts", () => {
  it("nets cycles inside one tab", () => {
    const txns = simplifyDebts([
      { from: "Bob", to: "Alice", amount: 20, settled: false },
      { from: "Alice", to: "Con", amount: 20, settled: false },
    ]);
    expect(txns).toEqual([{ from: "Bob", to: "Con", amount: 20 }]);
  });

  it("does not mix separate creator tabs when called per tab", () => {
    const aliceTab = simplifyDebts([{ from: "Bob", to: "Alice", amount: 10, settled: false }]);
    const danaTab = simplifyDebts([{ from: "Alice", to: "Bob", amount: 10, settled: false }]);
    expect(aliceTab[0]).toMatchObject({ from: "Bob", to: "Alice", amount: 10 });
    expect(danaTab[0]).toMatchObject({ from: "Alice", to: "Bob", amount: 10 });
  });
});

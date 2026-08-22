import { computeDebts } from "@/lib/debts";
import type { Bill, Contact, Group, InboxReceipt, Member, OcrResult } from "@/lib/types";

export const DEMO_USER_ID = "usr_alice";

/** Seed demo users have already picked a name, so they skip /welcome. */
const SEED_ONBOARDED_AT = "2026-01-01T00:00:00.000Z";

export const USERS: Member[] = [
  {
    id: "usr_alice",
    name: "Alice",
    shareToken: "st_k7q2n9xm4p",
    paynow: "+6591110001",
    paynowType: "mobile",
    email: "alice@example.com",
    onboardedAt: SEED_ONBOARDED_AT,
  },
  {
    id: "usr_bob",
    name: "Bob",
    shareToken: "st_h3w8c1vb6r",
    paynow: "+6592220002",
    paynowType: "mobile",
    email: "bob@example.com",
    onboardedAt: SEED_ONBOARDED_AT,
  },
  {
    id: "usr_con",
    name: "Con",
    shareToken: "st_m5t0j4yf2d",
    paynow: "+6593330003",
    paynowType: "mobile",
    email: "con@example.com",
    onboardedAt: SEED_ONBOARDED_AT,
  },
  {
    id: "usr_dana",
    name: "Dana",
    shareToken: "st_p9a6l2qk8z",
    paynow: "+6594440004",
    paynowType: "mobile",
    email: "dana@example.com",
    onboardedAt: SEED_ONBOARDED_AT,
  },
];

/** @deprecated use USERS — kept so older screens can import a familiar name */
export const MEMBERS = USERS;

export const SEED_GROUPS: Group[] = USERS.map((u) => ({
  id: `grp_${u.id.replace("usr_", "")}_personal`,
  ownerId: u.id,
  name: "Personal",
  isPersonal: true,
}));

function contact(creatorId: string, name: string): Contact {
  const user = USERS.find((u) => u.name === name);
  const slug = creatorId.replace("usr_", "");
  return {
    id: `ct_${slug}_${name.toLowerCase()}`,
    creatorId,
    groupId: `grp_${slug}_personal`,
    name,
    paynow: user?.paynow ?? "",
    shareToken: user && creatorId === user.id ? user.shareToken : `st_${slug}_${name.toLowerCase()}`,
    linkedUserId: user?.id,
  };
}

export const SEED_CONTACTS: Contact[] = [
  ...["Alice", "Bob", "Con", "Dana"].map((n) => contact("usr_alice", n)),
  ...["Alice", "Bob", "Con"].map((n) => contact("usr_bob", n)),
  ...["Alice", "Bob", "Con", "Dana"].map((n) => contact("usr_con", n)),
  ...["Alice", "Bob", "Con", "Dana"].map((n) => contact("usr_dana", n)),
];

export const DUMMY_OCR: Record<string, OcrResult> = {
  "bill-1": {
    occasion: "Handlebar @ Gillman",
    bill_date: "2026-05-20",
    currency: "SGD",
    items: [
      { name: "Grey Goose DBL", qty: 1, unitPrice: 32 },
      { name: "Lalala Love", qty: 1, unitPrice: 38 },
      { name: "Cocolove", qty: 1, unitPrice: 13 },
      { name: "Wings BBQ", qty: 1, unitPrice: 15 },
      { name: "Heineken Zero", qty: 1, unitPrice: 10 },
      { name: "Stuffed Jalapeno", qty: 1, unitPrice: 12 },
      { name: "Jever", qty: 1, unitPrice: 10 },
      { name: "Still Water", qty: 1, unitPrice: 7 },
      { name: "Handlebar Special", qty: 2, unitPrice: 13 },
      { name: "Chilli Cheese Nachos", qty: 1, unitPrice: 21 },
      { name: "Margherita", qty: 1, unitPrice: 16 },
      { name: "Cod Fish Bites", qty: 1, unitPrice: 15 },
      { name: "Carlsberg Mug", qty: 2, unitPrice: 21 },
    ],
    discount: 33.1,
    serviceCharge: 31.39,
    tax: 31.08,
    total: 376.37,
  },
  "bill-2": {
    occasion: "PS.Cafe Harding Road",
    bill_date: "2026-06-14",
    currency: "SGD",
    items: [
      { name: "Truffle Shoestring Fries", qty: 1, unitPrice: 18 },
      { name: "PS Burger", qty: 1, unitPrice: 28 },
      { name: "Mentaiko Pasta", qty: 1, unitPrice: 26 },
      { name: "Eggs Benedict", qty: 1, unitPrice: 24 },
      { name: "Flat White", qty: 2, unitPrice: 8 },
      { name: "Sparkling Water", qty: 1, unitPrice: 7 },
      { name: "Lemon Tart", qty: 1, unitPrice: 14 },
    ],
    discount: 0,
    serviceCharge: 13.3,
    tax: 13.18,
    total: 159.48,
  },
  "bill-3": {
    occasion: "Atlas Bar @ Parkview Sq",
    bill_date: "2026-07-05",
    currency: "SGD",
    items: [
      { name: "Negroni", qty: 1, unitPrice: 28 },
      { name: "Martini", qty: 1, unitPrice: 28 },
      { name: "Sidecar", qty: 1, unitPrice: 26 },
      { name: "Old Fashioned", qty: 1, unitPrice: 26 },
      { name: "Spritz", qty: 1, unitPrice: 24 },
      { name: "Soda Water", qty: 1, unitPrice: 8 },
      { name: "Bellini", qty: 1, unitPrice: 24 },
      { name: "Oysters (6 pcs)", qty: 1, unitPrice: 42 },
      { name: "Charcuterie Board", qty: 1, unitPrice: 38 },
      { name: "Truffle Arancini", qty: 1, unitPrice: 22 },
    ],
    discount: 0,
    serviceCharge: 29.6,
    tax: 29.31,
    total: 355.91,
  },
};

function bill(
  partial: Omit<Bill, "debts" | "currency" | "lockedAt"> & { lockedAt?: string | null },
): Bill {
  return {
    currency: "SGD",
    lockedAt: partial.lockedAt ?? null,
    ...partial,
    debts: computeDebts(
      partial.items,
      partial.names,
      partial.paidBy,
      partial.discount,
      partial.serviceCharge,
      partial.tax,
    ),
  };
}

export const SEED_BILLS: Bill[] = [
  bill({
    id: "bill-1",
    occasion: "Handlebar @ Gillman",
    billDate: "2026-05-20",
    items: [
      { name: "Grey Goose DBL", price: 32, assignee: "Alice", split: false, splitWith: [] },
      { name: "Lalala Love", price: 38, assignee: "Alice", split: false, splitWith: [] },
      { name: "Cocolove", price: 13, assignee: "Bob", split: false, splitWith: [] },
      { name: "Wings BBQ", price: 15, assignee: "Bob", split: false, splitWith: [] },
      { name: "Heineken Zero", price: 10, assignee: "Con", split: false, splitWith: [] },
      { name: "Stuffed Jalapeno", price: 12, assignee: "Con", split: false, splitWith: [] },
      { name: "Jever", price: 10, assignee: "Dana", split: false, splitWith: [] },
      { name: "Still Water", price: 7, assignee: "Dana", split: false, splitWith: [] },
      { name: "Handlebar Special #1", price: 13, assignee: null, split: true, splitWith: ["Alice", "Bob", "Con", "Dana"] },
      { name: "Handlebar Special #2", price: 13, assignee: null, split: true, splitWith: ["Alice", "Bob", "Con", "Dana"] },
      { name: "Chilli Cheese Nachos", price: 21, assignee: null, split: true, splitWith: ["Bob", "Con", "Dana"] },
      { name: "Margherita", price: 16, assignee: null, split: true, splitWith: ["Alice", "Bob", "Con", "Dana"] },
      { name: "Cod Fish Bites", price: 15, assignee: null, split: true, splitWith: ["Con", "Dana"] },
      { name: "Carlsberg Mug #1", price: 21, assignee: null, split: true, splitWith: ["Bob", "Dana"] },
      { name: "Carlsberg Mug #2", price: 21, assignee: null, split: true, splitWith: ["Bob", "Dana"] },
    ],
    names: ["Alice", "Bob", "Con", "Dana"],
    discount: 33.1,
    serviceCharge: 31.39,
    tax: 31.08,
    receiptTotal: 376.37,
    paidBy: "Alice",
    payNowNumber: "+6591110001",
    createdBy: "usr_alice",
    createdAt: "2026-05-20T21:00:00Z",
  }),
  bill({
    id: "bill-2",
    occasion: "PS.Cafe Harding Road",
    billDate: "2026-06-14",
    items: [
      { name: "Truffle Shoestring Fries", price: 18, assignee: null, split: true, splitWith: ["Alice", "Bob", "Con"] },
      { name: "PS Burger", price: 28, assignee: "Alice", split: false, splitWith: [] },
      { name: "Mentaiko Pasta", price: 26, assignee: "Con", split: false, splitWith: [] },
      { name: "Eggs Benedict", price: 24, assignee: "Bob", split: false, splitWith: [] },
      { name: "Flat White", price: 8, assignee: "Alice", split: false, splitWith: [] },
      { name: "Flat White", price: 8, assignee: "Con", split: false, splitWith: [] },
      { name: "Sparkling Water", price: 7, assignee: null, split: true, splitWith: ["Alice", "Bob", "Con"] },
      { name: "Lemon Tart", price: 14, assignee: null, split: true, splitWith: ["Alice", "Con"] },
    ],
    names: ["Alice", "Bob", "Con"],
    discount: 0,
    serviceCharge: 13.3,
    tax: 13.18,
    receiptTotal: 159.48,
    paidBy: "Bob",
    payNowNumber: "+6592220002",
    createdBy: "usr_bob",
    createdAt: "2026-06-14T13:00:00Z",
  }),
  bill({
    id: "bill-3",
    occasion: "Atlas Bar @ Parkview Sq",
    billDate: "2026-07-05",
    items: [
      { name: "Negroni", price: 28, assignee: "Alice", split: false, splitWith: [] },
      { name: "Martini", price: 28, assignee: "Alice", split: false, splitWith: [] },
      { name: "Sidecar", price: 26, assignee: "Bob", split: false, splitWith: [] },
      { name: "Old Fashioned", price: 26, assignee: "Bob", split: false, splitWith: [] },
      { name: "Spritz", price: 24, assignee: "Dana", split: false, splitWith: [] },
      { name: "Soda Water", price: 8, assignee: "Dana", split: false, splitWith: [] },
      { name: "Bellini", price: 24, assignee: "Con", split: false, splitWith: [] },
      { name: "Oysters (6 pcs)", price: 42, assignee: null, split: true, splitWith: ["Alice", "Bob", "Con", "Dana"] },
      { name: "Charcuterie Board", price: 38, assignee: null, split: true, splitWith: ["Alice", "Bob", "Con", "Dana"] },
      { name: "Truffle Arancini", price: 22, assignee: null, split: true, splitWith: ["Alice", "Bob"] },
    ],
    names: ["Alice", "Bob", "Con", "Dana"],
    discount: 0,
    serviceCharge: 29.6,
    tax: 29.31,
    receiptTotal: 355.91,
    paidBy: "Con",
    payNowNumber: "+6593330003",
    createdBy: "usr_con",
    createdAt: "2026-07-05T22:30:00Z",
  }),
];

export const SEED_INBOX: InboxReceipt[] = [
  {
    id: "rx-open",
    label: "Sunday brunch",
    capturedAt: "2026-08-16T11:20:00Z",
    processed: false,
    ownerId: "usr_alice",
    ocr: DUMMY_OCR["bill-2"],
  },
];

export function paynowFor(name: string) {
  return USERS.find((m) => m.name === name)?.paynow ?? "";
}

export function memberByToken(token: string) {
  return USERS.find((m) => m.shareToken === token);
}

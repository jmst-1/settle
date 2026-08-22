export type BillItem = {
  name: string;
  price: number;
  assignee: string | null;
  split: boolean;
  splitWith: string[];
};

export type BillDebt = {
  from: string;
  to: string;
  amount: number;
  settled: boolean;
};

export type Bill = {
  id: string;
  occasion: string;
  billDate: string;
  currency: string;
  items: BillItem[];
  names: string[];
  discount: number;
  serviceCharge: number;
  tax: number;
  receiptTotal: number;
  paidBy: string;
  payNowNumber: string;
  createdBy: string;
  debts: BillDebt[];
  createdAt: string;
  lockedAt: string | null;
};

export type InboxReceipt = {
  id: string;
  label: string;
  capturedAt: string;
  processed: boolean;
  ownerId: string;
  ocr?: OcrResult;
  imagePath?: string;
};

export type Member = {
  id: string;
  name: string;
  shareToken: string;
  paynow: string;
  paynowType: "mobile" | "uen";
  email?: string;
  /** Set when the user has chosen a display name (welcome or settings). */
  onboardedAt?: string | null;
};

export type Group = {
  id: string;
  ownerId: string;
  name: string;
  isPersonal: boolean;
};

/** A person on one creator's roster. Same display name, different creator → different id. */
export type Contact = {
  id: string;
  creatorId: string;
  groupId: string;
  name: string;
  paynow: string;
  shareToken: string;
  linkedUserId?: string;
};

export type AppNotification = {
  id: string;
  text: string;
  createdAt: string;
  read: boolean;
  forName: string;
  recipientUserId?: string;
};

export type OcrResult = {
  occasion: string;
  bill_date: string;
  currency: string;
  items: { name: string; qty: number; unitPrice: number }[];
  discount: number;
  serviceCharge: number;
  tax: number;
  total: number;
};

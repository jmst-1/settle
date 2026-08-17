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
  debts: BillDebt[];
  createdAt: string;
  lockedAt: string | null;
};

export type InboxReceipt = {
  id: string;
  label: string;
  capturedAt: string;
  processed: boolean;
  ocrKey: string;
};

export type Member = {
  name: string;
  shareToken: string;
  paynow: string;
  paynowType: "mobile" | "uen";
};

export type AppNotification = {
  id: string;
  text: string;
  createdAt: string;
  read: boolean;
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

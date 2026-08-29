export type BillItem = {
  name: string;
  price: number;
  assignee: string | null;
  split: boolean;
  splitWith: string[];
  receiptId?: string;
};

export type BillReceipt = {
  id: string;
  label: string;
  billDate: string;
  discount: number;
  serviceCharge: number;
  tax: number;
  receiptTotal: number;
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
  /** Per-slip extras. Omitted or one entry = a single-receipt bill. */
  receipts?: BillReceipt[];
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

/** Two roster people who tag items separately but settle as one wallet. Creator-scoped. */
export type PayeePair = {
  id: string;
  creatorId: string;
  memberNames: [string, string];
  settler: string;
};

export type AppNotification = {
  id: string;
  text: string;
  createdAt: string;
  read: boolean;
  forName: string;
  recipientUserId?: string;
  type?: "paid" | "suggested_split";
};

export type TxnCategory = "dining" | "other";
export type TxnStatus = "pending" | "dismissed" | "converted" | "matched";
export type MerchantRuleKind = "never_split" | "always_prompt";

export type AlertSettings = {
  amountThreshold: number;
  diningOnly: boolean;
  emailBack: boolean;
  enabled: boolean;
};

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  amountThreshold: 30,
  diningOnly: true,
  emailBack: false,
  enabled: true,
};

export type GmailStatus = {
  configured: boolean;
  connected: boolean;
  email?: string;
  lastSyncAt?: string | null;
};

export type CardTransaction = {
  id: string;
  ownerId: string;
  gmailMessageId: string;
  merchant: string;
  merchantNorm: string;
  amount: number;
  currency: string;
  txnDate: string;
  category: TxnCategory;
  confidence: number;
  sourceFrom?: string;
  status: TxnStatus;
  matchedBillId?: string;
  createdAt: string;
};

export type MerchantRule = {
  id: string;
  ownerId: string;
  merchantNorm: string;
  rule: MerchantRuleKind;
  dismissCount: number;
  confirmCount: number;
};

export type ParsedTransaction = {
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  isDining: boolean;
  confidence: number;
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

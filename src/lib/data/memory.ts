import { computeDebts, isInternalPairDebt } from "@/lib/debts";
import { demoSeedEnabled } from "@/lib/config";
import { debtMatchesExpanded, expandPairNames, matchRosterName, pairsForCreator } from "@/lib/me";
import { afterConfirm, afterDismiss, alwaysSkip } from "@/lib/alerts/learn";
import {
  DEMO_USER_ID,
  SEED_BILLS,
  SEED_CONTACTS,
  SEED_GROUPS,
  SEED_INBOX,
  SEED_PAIRS,
  SEED_TRANSACTIONS,
  USERS,
} from "@/lib/mock-data";
import type {
  AlertSettings,
  AppNotification,
  Bill,
  CardTransaction,
  Contact,
  GmailStatus,
  Group,
  InboxReceipt,
  Member,
  MerchantRule,
  OcrResult,
  PayeePair,
} from "@/lib/types";
import { DEFAULT_ALERT_SETTINGS } from "@/lib/types";
import { emailBackConfigured, gmailOAuthConfigured } from "@/lib/alerts/email-back";

export type StoredGmailConnection = {
  userId: string;
  email: string;
  refreshTokenEnc: string;
  historyId?: string | null;
  watchExpiration?: string | null;
  lastSyncAt?: string | null;
};

export type AppSnapshot = {
  users: Member[];
  contacts: Contact[];
  groups: Group[];
  pairs: PayeePair[];
  bills: Bill[];
  inbox: InboxReceipt[];
  notifications: AppNotification[];
  transactions: CardTransaction[];
  alertSettings: Record<string, AlertSettings>;
  merchantRules: MerchantRule[];
  gmailConnections: StoredGmailConnection[];
};

export type ClientState = {
  users: Member[];
  contacts: Contact[];
  groups: Group[];
  pairs: PayeePair[];
  bills: Bill[];
  inbox: InboxReceipt[];
  notifications: AppNotification[];
  currentUser: Member;
  transactions: CardTransaction[];
  alertSettings: AlertSettings;
  gmail: GmailStatus;
  merchantRules: MerchantRule[];
  emailBackConfigured: boolean;
};

const g = globalThis as unknown as { __splittab?: AppSnapshot };

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function emptySnapshot(): AppSnapshot {
  return {
    users: [],
    contacts: [],
    groups: [],
    pairs: [],
    bills: [],
    inbox: [],
    notifications: [],
    transactions: [],
    alertSettings: {},
    merchantRules: [],
    gmailConnections: [],
  };
}

function seedSnapshot(): AppSnapshot {
  const snap: AppSnapshot = {
    users: clone(USERS),
    contacts: clone(SEED_CONTACTS),
    groups: clone(SEED_GROUPS),
    pairs: clone(SEED_PAIRS),
    bills: clone(SEED_BILLS),
    inbox: clone(SEED_INBOX),
    notifications: [],
    transactions: clone(SEED_TRANSACTIONS),
    alertSettings: {},
    merchantRules: [],
    gmailConnections: [],
  };
  snap.bills = snap.bills.map((b) => settleInternalPairDebts(b, snap.pairs));
  return snap;
}

export function getSnapshot(): AppSnapshot {
  if (!g.__splittab) {
    g.__splittab = demoSeedEnabled() ? seedSnapshot() : emptySnapshot();
  }
  if (!g.__splittab.pairs) g.__splittab.pairs = [];
  if (!g.__splittab.transactions) g.__splittab.transactions = [];
  if (!g.__splittab.alertSettings) g.__splittab.alertSettings = {};
  if (!g.__splittab.merchantRules) g.__splittab.merchantRules = [];
  if (!g.__splittab.gmailConnections) g.__splittab.gmailConnections = [];
  return g.__splittab;
}

export function resetSnapshot(seed = demoSeedEnabled()) {
  g.__splittab = seed ? seedSnapshot() : emptySnapshot();
  return g.__splittab;
}

function withDebts(
  bill: Omit<Bill, "debts" | "lockedAt"> & { lockedAt?: string | null },
  pairs: PayeePair[] = [],
): Bill {
  const computed: Bill = {
    ...bill,
    lockedAt: bill.lockedAt ?? null,
    debts: computeDebts(
      bill.items,
      bill.names,
      bill.paidBy,
      bill.discount,
      bill.serviceCharge,
      bill.tax,
      bill.receipts,
    ),
  };
  return settleInternalPairDebts(computed, pairs);
}

function settleInternalPairDebts(bill: Bill, pairs: PayeePair[]): Bill {
  const creatorPairs = pairsForCreator(pairs, bill.createdBy);
  if (!creatorPairs.length) return bill;
  let changed = false;
  const debts = bill.debts.map((d) => {
    if (d.settled) return d;
    if (!isInternalPairDebt(d.from, d.to, creatorPairs)) return d;
    changed = true;
    return { ...d, settled: true };
  });
  return changed ? { ...bill, debts } : bill;
}

export function getUser(id: string) {
  return getSnapshot().users.find((u) => u.id === id) ?? null;
}

export function findUserByEmail(email: string) {
  const q = email.trim().toLowerCase();
  return getSnapshot().users.find((u) => u.email?.toLowerCase() === q) ?? null;
}

export function findContactByToken(token: string) {
  return getSnapshot().contacts.find((c) => c.shareToken === token) ?? null;
}

export function findUserByToken(token: string) {
  return getSnapshot().users.find((u) => u.shareToken === token) ?? null;
}

export function personalGroup(ownerId: string) {
  return getSnapshot().groups.find((g) => g.ownerId === ownerId && g.isPersonal) ?? null;
}

export function ensureUser(input: { id: string; email?: string; name: string; paynow?: string }): Member {
  const snap = getSnapshot();
  const existing = snap.users.find((u) => u.id === input.id);
  if (existing) {
    if (input.email && !existing.email) existing.email = input.email;
    return existing;
  }
  const byEmail = input.email ? findUserByEmail(input.email) : null;
  if (byEmail) return byEmail;

  const user: Member = {
    id: input.id,
    name: input.name,
    shareToken: crypto.randomUUID(),
    paynow: input.paynow ?? "",
    paynowType: "mobile",
    email: input.email,
  };
  snap.users.push(user);

  const group: Group = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    name: "Personal",
    isPersonal: true,
  };
  snap.groups.push(group);
  snap.contacts.push({
    id: crypto.randomUUID(),
    creatorId: user.id,
    groupId: group.id,
    name: user.name,
    paynow: user.paynow,
    shareToken: user.shareToken,
    linkedUserId: user.id,
  });
  return user;
}

export function clientState(userId: string): ClientState | null {
  const snap = getSnapshot();
  const currentUser = snap.users.find((u) => u.id === userId);
  if (!currentUser) return null;
  return {
    users: clone(snap.users),
    contacts: clone(snap.contacts),
    groups: clone(snap.groups),
    pairs: clone(snap.pairs),
    bills: clone(snap.bills),
    inbox: clone(snap.inbox.filter((r) => r.ownerId === userId)),
    notifications: clone(
      snap.notifications.filter((n) => n.forName === currentUser.name || n.recipientUserId === userId),
    ),
    currentUser: clone(currentUser),
    transactions: clone(snap.transactions.filter((t) => t.ownerId === userId)),
    alertSettings: clone(snap.alertSettings[userId] ?? DEFAULT_ALERT_SETTINGS),
    gmail: gmailStatusFor(userId),
    merchantRules: clone(snap.merchantRules.filter((r) => r.ownerId === userId)),
    emailBackConfigured: emailBackConfigured(),
  };
}

function gmailStatusFor(userId: string): GmailStatus {
  const row = getSnapshot().gmailConnections.find((c) => c.userId === userId);
  return {
    configured: gmailOAuthConfigured(),
    connected: Boolean(row),
    email: row?.email,
    lastSyncAt: row?.lastSyncAt ?? null,
  };
}

export function getAlertSettings(userId: string): AlertSettings {
  return clone(getSnapshot().alertSettings[userId] ?? DEFAULT_ALERT_SETTINGS);
}

export function updateAlertSettings(userId: string, patch: Partial<AlertSettings>): AlertSettings {
  const snap = getSnapshot();
  const next = { ...(snap.alertSettings[userId] ?? DEFAULT_ALERT_SETTINGS), ...patch };
  snap.alertSettings[userId] = next;
  return clone(next);
}

export function getGmailConnection(userId: string): StoredGmailConnection | null {
  return getSnapshot().gmailConnections.find((c) => c.userId === userId) ?? null;
}

export function listGmailConnections(): StoredGmailConnection[] {
  return [...getSnapshot().gmailConnections];
}

export function saveGmailConnection(row: StoredGmailConnection) {
  const snap = getSnapshot();
  const idx = snap.gmailConnections.findIndex((c) => c.userId === row.userId);
  if (idx >= 0) snap.gmailConnections[idx] = row;
  else snap.gmailConnections.push(row);
}

export function deleteGmailConnection(userId: string) {
  const snap = getSnapshot();
  snap.gmailConnections = snap.gmailConnections.filter((c) => c.userId !== userId);
}

export function getTransaction(userId: string, id: string) {
  return getSnapshot().transactions.find((t) => t.id === id && t.ownerId === userId) ?? null;
}

export function findTransactionByMessage(userId: string, gmailMessageId: string) {
  return (
    getSnapshot().transactions.find(
      (t) => t.ownerId === userId && t.gmailMessageId === gmailMessageId,
    ) ?? null
  );
}

export function insertTransaction(row: CardTransaction) {
  const snap = getSnapshot();
  snap.transactions.unshift(row);
  return row;
}

export function updateTransaction(userId: string, id: string, patch: Partial<CardTransaction>) {
  const snap = getSnapshot();
  const idx = snap.transactions.findIndex((t) => t.id === id && t.ownerId === userId);
  if (idx < 0) throw new Error("Transaction not found");
  snap.transactions[idx] = { ...snap.transactions[idx], ...patch };
  return snap.transactions[idx];
}

export function getMerchantRule(userId: string, merchantNorm: string) {
  return getSnapshot().merchantRules.find((r) => r.ownerId === userId && r.merchantNorm === merchantNorm) ?? null;
}

export function listMerchantRules(userId: string) {
  return getSnapshot().merchantRules.filter((r) => r.ownerId === userId);
}

export function upsertMerchantRule(rule: MerchantRule) {
  const snap = getSnapshot();
  const idx = snap.merchantRules.findIndex(
    (r) => r.ownerId === rule.ownerId && r.merchantNorm === rule.merchantNorm,
  );
  const next: MerchantRule = { ...rule, id: rule.id || crypto.randomUUID() };
  if (idx >= 0) snap.merchantRules[idx] = { ...next, id: snap.merchantRules[idx].id };
  else snap.merchantRules.push(next);
  return idx >= 0 ? snap.merchantRules[idx] : next;
}

export function insertNotification(n: AppNotification) {
  getSnapshot().notifications.unshift(n);
}

export function markSuggestedRead(userId: string) {
  const snap = getSnapshot();
  snap.notifications.forEach((n) => {
    if (n.type === "suggested_split" && (n.recipientUserId === userId || n.forName === getUser(userId)?.name)) {
      n.read = true;
    }
  });
}

export function setProfile(userId: string, name: string, paynow: string) {
  const snap = getSnapshot();
  const user = snap.users.find((u) => u.id === userId);
  if (!user) throw new Error("Not signed in");
  const prev = user.name;
  user.name = name.trim() || user.name;
  user.paynow = paynow.trim();
  snap.contacts.forEach((c) => {
    if (c.linkedUserId === userId || (c.creatorId === userId && c.name === prev)) {
      c.name = user.name;
      c.paynow = user.paynow;
    }
  });
  snap.bills.forEach((bill) => {
    if (bill.createdBy === userId) {
      bill.names = bill.names.map((n) => (n === prev ? user.name : n));
      bill.paidBy = bill.paidBy === prev ? user.name : bill.paidBy;
      bill.items = bill.items.map((it) => ({
        ...it,
        assignee: it.assignee === prev ? user.name : it.assignee,
        splitWith: it.splitWith.map((n) => (n === prev ? user.name : n)),
      }));
      bill.debts = bill.debts.map((d) => ({
        ...d,
        from: d.from === prev ? user.name : d.from,
        to: d.to === prev ? user.name : d.to,
      }));
    }
  });
  snap.pairs.forEach((p) => {
    if (!p.memberNames.includes(prev) && p.settler !== prev) return;
    p.memberNames = p.memberNames.map((n) => (n === prev ? user.name : n)) as [string, string];
    if (p.settler === prev) p.settler = user.name;
  });
  return clientState(userId);
}

export function addContact(userId: string, raw: string, paynow = "", groupId?: string): Contact {
  const snap = getSnapshot();
  const name = raw.trim();
  if (!name) throw new Error("Name required");
  const existing = matchRosterName(snap.contacts, userId, name, groupId);
  if (existing) return existing;
  const personal = personalGroup(userId);
  const gid = groupId || personal?.id;
  if (!gid) throw new Error("No group");
  const known = snap.users.find((u) => u.name.toLowerCase() === name.toLowerCase());
  const contact: Contact = {
    id: crypto.randomUUID(),
    creatorId: userId,
    groupId: gid,
    name,
    paynow: paynow || known?.paynow || "",
    shareToken: crypto.randomUUID(),
    linkedUserId: known?.id,
  };
  snap.contacts.push(contact);
  return contact;
}

function upsertRoster(userId: string, names: string[], payNowNumber: string, paidBy: string) {
  const snap = getSnapshot();
  for (const name of names) {
    const c = addContact(userId, name, name === paidBy ? payNowNumber : "");
    if (name === paidBy && payNowNumber) c.paynow = payNowNumber;
  }
  const payer = snap.users.find((u) => u.id === userId);
  if (payer && names.includes(payer.name) && payNowNumber && paidBy === payer.name) {
    payer.paynow = payNowNumber;
  }
}

export function saveBill(
  userId: string,
  input: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id"> & {
    id?: string;
    createdAt?: string;
  },
  inboxIds?: string | string[],
  transactionId?: string,
) {
  const snap = getSnapshot();
  upsertRoster(userId, input.names, input.payNowNumber, input.paidBy);
  const bill = withDebts(
    {
      ...input,
      id: input.id || crypto.randomUUID(),
      createdBy: userId,
      createdAt: input.createdAt || new Date().toISOString(),
      lockedAt: null,
    },
    snap.pairs,
  );
  snap.bills.unshift(bill);
  const idSet = new Set((Array.isArray(inboxIds) ? inboxIds : inboxIds ? [inboxIds] : []).filter(Boolean));
  if (idSet.size) {
    snap.inbox = snap.inbox.map((r) =>
      idSet.has(r.id) && r.ownerId === userId ? { ...r, processed: true } : r,
    );
  }
  if (transactionId) convertTransaction(userId, transactionId, bill.id);
  return bill;
}

export function updateBill(
  userId: string,
  billId: string,
  input: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id">,
) {
  const snap = getSnapshot();
  const idx = snap.bills.findIndex((b) => b.id === billId);
  if (idx < 0) throw new Error("Bill not found");
  const existing = snap.bills[idx];
  if (existing.createdBy !== userId) throw new Error("Only the tab creator can edit");
  if (existing.lockedAt) throw new Error("Bill is locked");
  upsertRoster(userId, input.names, input.payNowNumber, input.paidBy);
  const next = withDebts(
    {
      ...input,
      id: existing.id,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      lockedAt: null,
    },
    snap.pairs,
  );
  snap.bills[idx] = next;
  return next;
}

export function getBill(billId: string) {
  return getSnapshot().bills.find((b) => b.id === billId) ?? null;
}

export function listBillsForUser(userId: string) {
  return getSnapshot().bills.filter((b) => b.createdBy === userId);
}

export function settlePair(userId: string, from: string, to: string, creatorId: string) {
  const snap = getSnapshot();
  const user = getUser(userId);
  if (!user) throw new Error("Not signed in");
  const allowed =
    user.id === creatorId ||
    expandPairNames(snap.pairs, creatorId, from).includes(user.name) ||
    expandPairNames(snap.pairs, creatorId, to).includes(user.name);
  if (!allowed) throw new Error("You can only tag a debt you’re on, or your own tab");
  snap.bills.forEach((bill) => {
    if (bill.createdBy !== creatorId) return;
    const hit = bill.debts.some((d) => debtMatchesExpanded(d, from, to, snap.pairs, creatorId));
    if (hit && !bill.lockedAt) bill.lockedAt = new Date().toISOString();
    bill.debts = bill.debts.map((d) =>
      debtMatchesExpanded(d, from, to, snap.pairs, creatorId) ? { ...d, settled: true } : d,
    );
  });
  return clientState(userId);
}

export function undoPair(userId: string, from: string, to: string, creatorId: string) {
  const snap = getSnapshot();
  if (userId !== creatorId) throw new Error("Only the tab creator can undo");
  const creatorPairs = pairsForCreator(snap.pairs, creatorId);
  snap.bills.forEach((bill) => {
    if (bill.createdBy !== creatorId) return;
    bill.debts = bill.debts.map((d) => {
      if (isInternalPairDebt(d.from, d.to, creatorPairs)) return d;
      return debtMatchesExpanded(d, from, to, snap.pairs, creatorId)
        ? { ...d, settled: false }
        : d;
    });
    if (!bill.debts.some((d) => d.settled)) bill.lockedAt = null;
  });
  return clientState(userId);
}

export function portalPayload(token: string) {
  const snap = getSnapshot();
  const contact = findContactByToken(token);
  const user = findUserByToken(token);
  const name = contact?.name ?? user?.name;
  if (!name) return null;
  const creatorFilter = contact && !user ? contact.creatorId : undefined;
  const bills = snap.bills.filter((b) => {
    if (creatorFilter && b.createdBy !== creatorFilter) return false;
    const aliases = expandPairNames(snap.pairs, b.createdBy, name);
    return aliases.some((n) => b.names.includes(n));
  });
  return {
    token,
    name,
    linkedUserId: contact?.linkedUserId ?? user?.id ?? null,
    creatorId: contact?.creatorId ?? user?.id ?? null,
    bills,
    users: snap.users,
    contacts: snap.contacts,
    pairs: snap.pairs,
  };
}

export function portalPay(token: string, from: string, to: string, billIds: string[]) {
  const payload = portalPayload(token);
  if (!payload || payload.name !== from) throw new Error("Invalid token");
  const snap = getSnapshot();
  const idSet = new Set(billIds);
  const amount = snap.bills
    .filter((b) => idSet.has(b.id))
    .flatMap((b) =>
      b.debts
        .filter((d) => !d.settled && debtMatchesExpanded(d, from, to, snap.pairs, b.createdBy))
        .map((d) => d.amount),
    )
    .reduce((s, n) => s + n, 0);
  if (amount <= 0) {
    return { amount: 0, alreadySettled: true };
  }
  const now = new Date().toISOString();
  snap.bills.forEach((bill) => {
    if (!idSet.has(bill.id)) return;
    const hit = bill.debts.some(
      (d) => !d.settled && debtMatchesExpanded(d, from, to, snap.pairs, bill.createdBy),
    );
    if (hit && !bill.lockedAt) bill.lockedAt = now;
    bill.debts = bill.debts.map((d) =>
      !d.settled && debtMatchesExpanded(d, from, to, snap.pairs, bill.createdBy)
        ? { ...d, settled: true }
        : d,
    );
  });
  const pair = snap.pairs.find((p) =>
    snap.bills.some(
      (b) => idSet.has(b.id) && p.creatorId === b.createdBy && p.memberNames.includes(from),
    ),
  );
  const actor = pair ? pair.memberNames.join(" & ") : from;
  const creditorUser = snap.users.find((u) => u.name === to);
  snap.notifications.unshift({
    id: crypto.randomUUID(),
    text: `${actor} paid ${to} · SGD ${amount.toFixed(2)}`,
    createdAt: now,
    read: false,
    forName: to,
    recipientUserId: creditorUser?.id,
  });
  return { amount, alreadySettled: false };
}

export function captureInbox(
  userId: string,
  input: { label: string; imagePath?: string; ocr?: OcrResult },
) {
  const snap = getSnapshot();
  const row: InboxReceipt = {
    id: crypto.randomUUID(),
    label: input.label.trim() || "Receipt",
    capturedAt: new Date().toISOString(),
    processed: false,
    ownerId: userId,
    imagePath: input.imagePath,
    ocr: input.ocr,
  };
  snap.inbox.unshift(row);
  return row;
}

export function getInboxItem(userId: string, id: string) {
  return getSnapshot().inbox.find((r) => r.id === id && r.ownerId === userId) ?? null;
}

export function markNotificationsRead(userId: string) {
  const snap = getSnapshot();
  const user = getUser(userId);
  if (!user) return;
  snap.notifications.forEach((n) => {
    if ((n.forName === user.name || n.recipientUserId === userId) && n.type !== "suggested_split") {
      n.read = true;
    }
  });
}

export function claimToken(userId: string, token: string) {
  const user = getUser(userId);
  if (!user) throw new Error("Not signed in");
  const contact = findContactByToken(token);
  if (contact) {
    contact.linkedUserId = userId;
    if (!contact.paynow && user.paynow) contact.paynow = user.paynow;
  }
  return clientState(userId);
}

export function createGroup(userId: string, name: string) {
  const snap = getSnapshot();
  const group: Group = {
    id: crypto.randomUUID(),
    ownerId: userId,
    name: name.trim() || "Group",
    isPersonal: false,
  };
  snap.groups.push(group);
  const user = getUser(userId);
  if (user) {
    snap.contacts.push({
      id: crypto.randomUUID(),
      creatorId: userId,
      groupId: group.id,
      name: user.name,
      paynow: user.paynow,
      shareToken: crypto.randomUUID(),
      linkedUserId: userId,
    });
  }
  return group;
}

export function addGroupMember(userId: string, groupId: string, name: string, paynow = "") {
  const snap = getSnapshot();
  const group = snap.groups.find((g) => g.id === groupId && g.ownerId === userId);
  if (!group) throw new Error("Group not found");
  return addContact(userId, name, paynow, groupId);
}

export function combinePayees(userId: string, a: string, b: string, settler: string) {
  const snap = getSnapshot();
  const names: [string, string] = [a.trim(), b.trim()];
  if (!names[0] || !names[1] || names[0] === names[1]) throw new Error("Pick two different people");
  if (settler !== names[0] && settler !== names[1]) throw new Error("Settler must be one of the pair");
  const already = snap.pairs.some(
    (p) =>
      p.creatorId === userId &&
      (p.memberNames.includes(names[0]) || p.memberNames.includes(names[1])),
  );
  if (already) throw new Error("One of them is already combined");
  const pair: PayeePair = {
    id: crypto.randomUUID(),
    creatorId: userId,
    memberNames: names,
    settler,
  };
  snap.pairs.push(pair);
  snap.bills = snap.bills.map((bill) =>
    bill.createdBy === userId ? settleInternalPairDebts(bill, snap.pairs) : bill,
  );
  return clientState(userId);
}

export function uncombinePayees(userId: string, pairId: string) {
  const snap = getSnapshot();
  const pair = snap.pairs.find((p) => p.id === pairId);
  if (!pair || pair.creatorId !== userId) throw new Error("Pair not found");
  snap.pairs = snap.pairs.filter((p) => p.id !== pairId);
  return clientState(userId);
}

export function convertTransaction(userId: string, id: string, billId: string) {
  const txn = getTransaction(userId, id);
  if (!txn) throw new Error("Transaction not found");
  const next = updateTransaction(userId, id, { status: "converted", matchedBillId: billId });
  const existing = getMerchantRule(userId, txn.merchantNorm);
  upsertMerchantRule(afterConfirm(existing, txn.merchantNorm, userId));
  return next;
}

export function dismissTransaction(userId: string, id: string) {
  const txn = getTransaction(userId, id);
  if (!txn) throw new Error("Transaction not found");
  const next = updateTransaction(userId, id, { status: "dismissed" });
  const existing = getMerchantRule(userId, txn.merchantNorm);
  upsertMerchantRule(afterDismiss(existing, txn.merchantNorm, userId));
  return next;
}

export function undoTransaction(userId: string, id: string) {
  const txn = getTransaction(userId, id);
  if (!txn) throw new Error("Transaction not found");
  return updateTransaction(userId, id, { status: "pending", matchedBillId: undefined });
}

export function neverSplitTransaction(userId: string, id: string) {
  const txn = getTransaction(userId, id);
  if (!txn) throw new Error("Transaction not found");
  const next = updateTransaction(userId, id, { status: "dismissed" });
  const existing = getMerchantRule(userId, txn.merchantNorm);
  upsertMerchantRule(alwaysSkip(existing, txn.merchantNorm, userId));
  return next;
}

export function matchTransaction(userId: string, id: string, billId: string) {
  const txn = getTransaction(userId, id);
  if (!txn) throw new Error("Transaction not found");
  const bill = getBill(billId);
  if (!bill) throw new Error("Bill not found");
  const next = updateTransaction(userId, id, { status: "matched", matchedBillId: billId });
  const existing = getMerchantRule(userId, txn.merchantNorm);
  upsertMerchantRule(afterConfirm(existing, txn.merchantNorm, userId));
  return next;
}

export const DEMO_DEFAULT_USER = DEMO_USER_ID;

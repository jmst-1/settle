import { computeDebts } from "@/lib/debts";
import { demoSeedEnabled } from "@/lib/config";
import { matchRosterName } from "@/lib/me";
import {
  DEMO_USER_ID,
  SEED_BILLS,
  SEED_CONTACTS,
  SEED_GROUPS,
  SEED_INBOX,
  USERS,
} from "@/lib/mock-data";
import type {
  AppNotification,
  Bill,
  Contact,
  Group,
  InboxReceipt,
  Member,
  OcrResult,
} from "@/lib/types";

export type AppSnapshot = {
  users: Member[];
  contacts: Contact[];
  groups: Group[];
  bills: Bill[];
  inbox: InboxReceipt[];
  notifications: AppNotification[];
};

export type ClientState = AppSnapshot & {
  currentUser: Member;
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
    bills: [],
    inbox: [],
    notifications: [],
  };
}

function seedSnapshot(): AppSnapshot {
  return {
    users: clone(USERS),
    contacts: clone(SEED_CONTACTS),
    groups: clone(SEED_GROUPS),
    bills: clone(SEED_BILLS),
    inbox: clone(SEED_INBOX),
    notifications: [],
  };
}

export function getSnapshot(): AppSnapshot {
  if (!g.__splittab) {
    g.__splittab = demoSeedEnabled() ? seedSnapshot() : emptySnapshot();
  }
  return g.__splittab;
}

export function resetSnapshot(seed = demoSeedEnabled()) {
  g.__splittab = seed ? seedSnapshot() : emptySnapshot();
  return g.__splittab;
}

function withDebts(bill: Omit<Bill, "debts" | "lockedAt"> & { lockedAt?: string | null }): Bill {
  return {
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
    onboardedAt: null,
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
    bills: clone(snap.bills),
    inbox: clone(snap.inbox.filter((r) => r.ownerId === userId)),
    notifications: clone(
      snap.notifications.filter((n) => n.forName === currentUser.name || n.recipientUserId === userId),
    ),
    currentUser: clone(currentUser),
  };
}

export function setProfile(userId: string, name: string, paynow: string) {
  const snap = getSnapshot();
  const user = snap.users.find((u) => u.id === userId);
  if (!user) throw new Error("Not signed in");
  const prev = user.name;
  user.name = name.trim() || user.name;
  user.paynow = paynow.trim();
  user.onboardedAt = user.onboardedAt ?? new Date().toISOString();
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
) {
  const snap = getSnapshot();
  upsertRoster(userId, input.names, input.payNowNumber, input.paidBy);
  const bill = withDebts({
    ...input,
    id: input.id || crypto.randomUUID(),
    createdBy: userId,
    createdAt: input.createdAt || new Date().toISOString(),
    lockedAt: null,
  });
  snap.bills.unshift(bill);
  const idSet = new Set((Array.isArray(inboxIds) ? inboxIds : inboxIds ? [inboxIds] : []).filter(Boolean));
  if (idSet.size) {
    snap.inbox = snap.inbox.map((r) =>
      idSet.has(r.id) && r.ownerId === userId ? { ...r, processed: true } : r,
    );
  }
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
  const next = withDebts({
    ...input,
    id: existing.id,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    lockedAt: null,
  });
  snap.bills[idx] = next;
  return next;
}

export function getBill(billId: string) {
  return getSnapshot().bills.find((b) => b.id === billId) ?? null;
}

export function settlePair(userId: string, from: string, to: string, creatorId: string) {
  const snap = getSnapshot();
  const user = getUser(userId);
  if (!user) throw new Error("Not signed in");
  const allowed = user.id === creatorId || user.name === from || user.name === to;
  if (!allowed) throw new Error("You can only tag a debt you’re on, or your own tab");
  snap.bills.forEach((bill) => {
    if (bill.createdBy !== creatorId) return;
    const hit = bill.debts.some(
      (d) => (d.from === from && d.to === to) || (d.from === to && d.to === from),
    );
    if (hit && !bill.lockedAt) bill.lockedAt = new Date().toISOString();
    bill.debts = bill.debts.map((d) => {
      const match = (d.from === from && d.to === to) || (d.from === to && d.to === from);
      return match ? { ...d, settled: true } : d;
    });
  });
  return clientState(userId);
}

export function undoPair(userId: string, from: string, to: string, creatorId: string) {
  const snap = getSnapshot();
  if (userId !== creatorId) throw new Error("Only the tab creator can undo");
  snap.bills.forEach((bill) => {
    if (bill.createdBy !== creatorId) return;
    bill.debts = bill.debts.map((d) => {
      const match = (d.from === from && d.to === to) || (d.from === to && d.to === from);
      return match ? { ...d, settled: false } : d;
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
    return b.names.includes(name);
  });
  return {
    token,
    name,
    linkedUserId: contact?.linkedUserId ?? user?.id ?? null,
    creatorId: contact?.creatorId ?? user?.id ?? null,
    bills,
    users: snap.users,
    contacts: snap.contacts,
  };
}

export function portalPay(token: string, from: string, to: string, billIds: string[]) {
  const payload = portalPayload(token);
  if (!payload || payload.name !== from) throw new Error("Invalid token");
  const snap = getSnapshot();
  const idSet = new Set(billIds);
  const amount = snap.bills
    .filter((b) => idSet.has(b.id))
    .flatMap((b) => b.debts)
    .filter((d) => d.from === from && d.to === to && !d.settled)
    .reduce((s, d) => s + d.amount, 0);
  if (amount <= 0) {
    return { amount: 0, alreadySettled: true };
  }
  const now = new Date().toISOString();
  snap.bills.forEach((bill) => {
    if (!idSet.has(bill.id)) return;
    const hit = bill.debts.some((d) => d.from === from && d.to === to && !d.settled);
    if (hit && !bill.lockedAt) bill.lockedAt = now;
    bill.debts = bill.debts.map((d) =>
      d.from === from && d.to === to ? { ...d, settled: true } : d,
    );
  });
  const creditorUser = snap.users.find((u) => u.name === to);
  snap.notifications.unshift({
    id: crypto.randomUUID(),
    text: `${from} paid ${to} · SGD ${amount.toFixed(2)}`,
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
    if (n.forName === user.name || n.recipientUserId === userId) n.read = true;
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

export const DEMO_DEFAULT_USER = DEMO_USER_ID;

import { simplifyDebts } from "@/lib/debts";
import type { Bill, Contact, Group, Member } from "@/lib/types";

export function userById(users: Member[], id: string) {
  return users.find((u) => u.id === id);
}

export function userByName(users: Member[], name: string) {
  return users.find((u) => u.name.toLowerCase() === name.toLowerCase());
}

export function userByToken(users: Member[], token: string) {
  return users.find((u) => u.shareToken === token);
}

export function contactByToken(contacts: Contact[], token: string) {
  return contacts.find((c) => c.shareToken === token);
}

export function creatorName(users: Member[], creatorId: string) {
  return userById(users, creatorId)?.name ?? "Someone";
}

export function rosterFor(contacts: Contact[], creatorId: string, groupId?: string) {
  return contacts.filter((c) => {
    if (c.creatorId !== creatorId) return false;
    if (groupId) return c.groupId === groupId;
    return true;
  });
}

export function personalRoster(contacts: Contact[], groups: Group[], creatorId: string) {
  const personal = groups.find((g) => g.ownerId === creatorId && g.isPersonal);
  if (!personal) return rosterFor(contacts, creatorId);
  return contacts.filter((c) => c.groupId === personal.id);
}

export function matchRosterName(
  contacts: Contact[],
  creatorId: string,
  raw: string,
  groupId?: string,
) {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  return rosterFor(contacts, creatorId, groupId).find((c) => c.name.toLowerCase() === q) ?? null;
}

export function visibleBills(bills: Bill[], user: Member) {
  return bills.filter((b) => b.createdBy === user.id || b.names.includes(user.name));
}

export function myOutstanding(bills: Bill[], name: string) {
  const debts = bills.flatMap((b) => b.debts);
  const owe = debts.filter((d) => d.from === name && !d.settled).reduce((s, d) => s + d.amount, 0);
  const owed = debts.filter((d) => d.to === name && !d.settled).reduce((s, d) => s + d.amount, 0);
  return { owe, owed };
}

export type CreatorTab = {
  creatorId: string;
  bills: Bill[];
  simplified: { from: string; to: string; amount: number }[];
  rawUnsettled: { from: string; to: string; amount: number; occasion: string }[];
};

export function tabsByCreator(bills: Bill[]): CreatorTab[] {
  const map = new Map<string, Bill[]>();
  for (const bill of bills) {
    const list = map.get(bill.createdBy) ?? [];
    list.push(bill);
    map.set(bill.createdBy, list);
  }
  return Array.from(map.entries()).map(([creatorId, group]) => {
    const rawUnsettled = group.flatMap((b) =>
      b.debts.filter((d) => !d.settled).map((d) => ({ ...d, occasion: b.occasion })),
    );
    return {
      creatorId,
      bills: group,
      simplified: simplifyDebts(rawUnsettled),
      rawUnsettled,
    };
  });
}

export function involvingMe(
  txns: { from: string; to: string; amount: number }[],
  name: string,
) {
  return txns.filter((t) => t.from === name || t.to === name);
}

export function canTagSettlement(user: Member, creatorId: string, from: string, to: string) {
  return user.id === creatorId || user.name === from || user.name === to;
}

export function canUndoSettlement(user: Member, creatorId: string) {
  return user.id === creatorId;
}

export function paynowForContact(
  contacts: Contact[],
  users: Member[],
  name: string,
  creatorId?: string,
) {
  if (creatorId) {
    const mine = contacts.find((c) => c.creatorId === creatorId && c.name === name);
    if (mine?.paynow) return mine.paynow;
  }
  return users.find((u) => u.name === name)?.paynow ?? "";
}

export function tokenForPerson(
  contacts: Contact[],
  users: Member[],
  name: string,
  creatorId?: string,
) {
  if (creatorId) {
    const c = contacts.find((x) => x.creatorId === creatorId && x.name === name);
    if (c?.shareToken) return c.shareToken;
  }
  return users.find((u) => u.name === name)?.shareToken;
}

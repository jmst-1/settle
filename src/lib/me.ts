import { foldDebtsForPairs, simplifyDebts } from "@/lib/debts";
import type { Bill, Contact, Group, Member, PayeePair } from "@/lib/types";

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

export function pairsForCreator(pairs: PayeePair[], creatorId: string) {
  return pairs.filter((p) => p.creatorId === creatorId);
}

export function pairContaining(pairs: PayeePair[], creatorId: string, name: string) {
  return pairsForCreator(pairs, creatorId).find((p) => p.memberNames.includes(name)) ?? null;
}

export function partnerName(pair: PayeePair, name: string) {
  return pair.memberNames.find((n) => n !== name) ?? null;
}

export function expandPairNames(pairs: PayeePair[], creatorId: string, name: string) {
  const pair = pairContaining(pairs, creatorId, name);
  return pair ? [...pair.memberNames] : [name];
}

export function settlementPayerLabel(
  name: string,
  pairs: PayeePair[],
  creatorId: string,
  you?: string,
) {
  const pair = pairContaining(pairs, creatorId, name);
  const display = you && name === you ? "You" : name;
  if (!pair || pair.settler !== name) return display;
  const partner = partnerName(pair, pair.settler);
  if (!partner) return display;
  const partnerDisplay = you && partner === you ? "you" : partner;
  return `${display} (for ${partnerDisplay})`;
}

export function debtMatchesExpanded(
  debt: { from: string; to: string },
  from: string,
  to: string,
  pairs: PayeePair[],
  creatorId: string,
) {
  const fromNames = expandPairNames(pairs, creatorId, from);
  const toNames = expandPairNames(pairs, creatorId, to);
  return (
    (fromNames.includes(debt.from) && toNames.includes(debt.to)) ||
    (fromNames.includes(debt.to) && toNames.includes(debt.from))
  );
}

export function visibleBills(bills: Bill[], user: Member) {
  return bills.filter((b) => b.createdBy === user.id || b.names.includes(user.name));
}

export function myOutstanding(bills: Bill[], name: string, pairs: PayeePair[] = []) {
  const map = new Map<string, Bill[]>();
  for (const bill of bills) {
    const list = map.get(bill.createdBy) ?? [];
    list.push(bill);
    map.set(bill.createdBy, list);
  }
  let owe = 0;
  let owed = 0;
  Array.from(map.entries()).forEach(([creatorId, group]) => {
    const folded = foldDebtsForPairs(
      group.flatMap((b) => b.debts.filter((d) => !d.settled)),
      pairsForCreator(pairs, creatorId),
    );
    owe += folded.filter((d) => d.from === name).reduce((s, d) => s + d.amount, 0);
    owed += folded.filter((d) => d.to === name).reduce((s, d) => s + d.amount, 0);
  });
  return { owe, owed };
}

export type CreatorTab = {
  creatorId: string;
  bills: Bill[];
  simplified: { from: string; to: string; amount: number }[];
  rawUnsettled: { from: string; to: string; amount: number; occasion: string }[];
};

export function tabsByCreator(bills: Bill[], pairs: PayeePair[] = []): CreatorTab[] {
  const map = new Map<string, Bill[]>();
  for (const bill of bills) {
    const list = map.get(bill.createdBy) ?? [];
    list.push(bill);
    map.set(bill.createdBy, list);
  }
  return Array.from(map.entries()).map(([creatorId, group]) => {
    const rawUnsettled = foldDebtsForPairs(
      group.flatMap((b) =>
        b.debts.filter((d) => !d.settled).map((d) => ({ ...d, occasion: b.occasion })),
      ),
      pairsForCreator(pairs, creatorId),
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
  pairs: PayeePair[] = [],
  creatorId?: string,
) {
  const aliases = new Set(creatorId ? expandPairNames(pairs, creatorId, name) : [name]);
  return txns.filter((t) => aliases.has(t.from) || aliases.has(t.to));
}

export function canTagSettlement(
  user: Member,
  creatorId: string,
  from: string,
  to: string,
  pairs: PayeePair[] = [],
) {
  if (user.id === creatorId) return true;
  const fromNames = expandPairNames(pairs, creatorId, from);
  const toNames = expandPairNames(pairs, creatorId, to);
  return fromNames.includes(user.name) || toNames.includes(user.name);
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

export function coveredByNote(pairs: PayeePair[], name: string) {
  const covering = pairs.filter((p) => p.memberNames.includes(name) && p.settler !== name);
  if (!covering.length) return null;
  const settlers = Array.from(new Set(covering.map((p) => p.settler)));
  if (settlers.length === 1) return `${settlers[0]} settles for you`;
  return `${settlers.join(" / ")} settle for you`;
}

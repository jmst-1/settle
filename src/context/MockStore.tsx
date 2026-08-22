"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { computeDebts, isInternalPairDebt } from "@/lib/debts";
import { expandPairNames, matchRosterName, pairsForCreator } from "@/lib/me";
import {
  SEED_BILLS,
  SEED_CONTACTS,
  SEED_INBOX,
  SEED_PAIRS,
  SUPER_USER_ID,
  USERS,
} from "@/lib/mock-data";
import type { AppNotification, Bill, Contact, InboxReceipt, Member, PayeePair } from "@/lib/types";

type MockState = {
  users: Member[];
  contacts: Contact[];
  pairs: PayeePair[];
  currentUserId: string;
  bills: Bill[];
  inbox: InboxReceipt[];
  notifications: AppNotification[];
  toast: string | null;
};

type MockStore = MockState & {
  currentUser: Member;
  setCurrentUser: (id: string) => void;
  setProfile: (name: string, paynow: string) => void;
  addContact: (name: string, paynow?: string) => Contact;
  combinePayees: (a: string, b: string, settler: string) => void;
  uncombinePayees: (pairId: string) => void;
  saveBill: (bill: Omit<Bill, "debts" | "lockedAt">, inboxId?: string) => void;
  settlePair: (from: string, to: string, creatorId: string) => void;
  undoPair: (from: string, to: string, creatorId: string) => void;
  portalPay: (from: string, to: string, billIds: string[]) => void;
  captureInbox: (label: string) => void;
  markNotificationRead: () => void;
  clearToast: () => void;
};

const MockContext = createContext<MockStore | null>(null);

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

function debtMatchesPair(
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

export function MockProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockState>({
    users: USERS,
    contacts: SEED_CONTACTS,
    pairs: SEED_PAIRS,
    currentUserId: SUPER_USER_ID,
    bills: SEED_BILLS.map((b) => settleInternalPairDebts(b, SEED_PAIRS)),
    inbox: SEED_INBOX,
    notifications: [],
    toast: null,
  });

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? state.users[0],
    [state.users, state.currentUserId],
  );

  const setCurrentUser = useCallback((id: string) => {
    setState((prev) => ({ ...prev, currentUserId: id }));
  }, []);

  const setProfile = useCallback((name: string, paynow: string) => {
    setState((prev) => {
      const oldName = prev.users.find((u) => u.id === prev.currentUserId)?.name;
      return {
        ...prev,
        users: prev.users.map((u) =>
          u.id === prev.currentUserId ? { ...u, name, paynow } : u,
        ),
        contacts: prev.contacts.map((c) =>
          c.creatorId === prev.currentUserId && c.name === oldName
            ? { ...c, name, paynow }
            : c,
        ),
        pairs: oldName
          ? prev.pairs.map((p) => {
              if (!p.memberNames.includes(oldName) && p.settler !== oldName) return p;
              const memberNames = p.memberNames.map((n) => (n === oldName ? name : n)) as [
                string,
                string,
              ];
              return {
                ...p,
                memberNames,
                settler: p.settler === oldName ? name : p.settler,
              };
            })
          : prev.pairs,
      };
    });
  }, []);

  const addContact = useCallback(
    (raw: string, paynow = ""): Contact => {
      const name = raw.trim();
      const existing = matchRosterName(state.contacts, currentUser.id, name);
      if (existing) return existing;
      const known = state.users.find((u) => u.name.toLowerCase() === name.toLowerCase());
      const contact: Contact = {
        id: `ct_${currentUser.id.replace("usr_", "")}_${name.toLowerCase().replace(/\s+/g, "-")}_${Math.random().toString(36).slice(2, 6)}`,
        creatorId: currentUser.id,
        name,
        paynow: paynow || known?.paynow || "",
      };
      setState((prev) => ({ ...prev, contacts: [...prev.contacts, contact] }));
      return contact;
    },
    [currentUser.id, state.contacts, state.users],
  );

  const combinePayees = useCallback((a: string, b: string, settler: string) => {
    setState((prev) => {
      const creatorId = prev.currentUserId;
      const names: [string, string] = [a.trim(), b.trim()];
      if (!names[0] || !names[1] || names[0] === names[1]) return prev;
      if (settler !== names[0] && settler !== names[1]) return prev;
      const already = prev.pairs.some(
        (p) =>
          p.creatorId === creatorId &&
          (p.memberNames.includes(names[0]) || p.memberNames.includes(names[1])),
      );
      if (already) return prev;
      const pair: PayeePair = {
        id: `pair_${creatorId.replace("usr_", "")}_${names[0].toLowerCase()}_${names[1].toLowerCase()}`,
        creatorId,
        memberNames: names,
        settler,
      };
      const pairs = [...prev.pairs, pair];
      return {
        ...prev,
        pairs,
        bills: prev.bills.map((bill) =>
          bill.createdBy === creatorId ? settleInternalPairDebts(bill, pairs) : bill,
        ),
        toast: `${names[0]} + ${names[1]} · ${settler} settles`,
      };
    });
  }, []);

  const uncombinePayees = useCallback((pairId: string) => {
    setState((prev) => {
      const pair = prev.pairs.find((p) => p.id === pairId);
      if (!pair || pair.creatorId !== prev.currentUserId) return prev;
      return {
        ...prev,
        pairs: prev.pairs.filter((p) => p.id !== pairId),
        toast: `${pair.memberNames[0]} and ${pair.memberNames[1]} settle separately`,
      };
    });
  }, []);

  const saveBill = useCallback((bill: Omit<Bill, "debts" | "lockedAt">, inboxId?: string) => {
    setState((prev) => ({
      ...prev,
      bills: [withDebts(bill, prev.pairs), ...prev.bills],
      inbox: inboxId
        ? prev.inbox.map((r) => (r.id === inboxId ? { ...r, processed: true } : r))
        : prev.inbox,
    }));
  }, []);

  const settlePair = useCallback((from: string, to: string, creatorId: string) => {
    setState((prev) => ({
      ...prev,
      bills: prev.bills.map((bill) => {
        if (bill.createdBy !== creatorId) return bill;
        const hit = bill.debts.some((d) => debtMatchesPair(d, from, to, prev.pairs, creatorId));
        return {
          ...bill,
          lockedAt: hit ? bill.lockedAt || new Date().toISOString() : bill.lockedAt,
          debts: bill.debts.map((d) =>
            debtMatchesPair(d, from, to, prev.pairs, creatorId) ? { ...d, settled: true } : d,
          ),
        };
      }),
      toast: `Marked ${from} → ${to} as paid`,
    }));
  }, []);

  const undoPair = useCallback((from: string, to: string, creatorId: string) => {
    setState((prev) => ({
      ...prev,
      bills: prev.bills.map((bill) => {
        if (bill.createdBy !== creatorId) return bill;
        return {
          ...bill,
          debts: bill.debts.map((d) => {
            if (isInternalPairDebt(d.from, d.to, pairsForCreator(prev.pairs, creatorId))) {
              return d;
            }
            return debtMatchesPair(d, from, to, prev.pairs, creatorId)
              ? { ...d, settled: false }
              : d;
          }),
        };
      }),
      toast: `Reopened ${from} ↔ ${to}`,
    }));
  }, []);

  const portalPay = useCallback((from: string, to: string, billIds: string[]) => {
    const idSet = new Set(billIds);
    setState((prev) => {
      let amount = 0;
      const bills = prev.bills.map((bill) => {
        if (!idSet.has(bill.id)) return bill;
        const match = (d: { from: string; to: string; settled: boolean; amount: number }) =>
          !d.settled && debtMatchesPair(d, from, to, prev.pairs, bill.createdBy);
        amount += bill.debts.filter(match).reduce((s, d) => s + d.amount, 0);
        const hit = bill.debts.some(match);
        return {
          ...bill,
          lockedAt: hit ? bill.lockedAt || new Date().toISOString() : bill.lockedAt,
          debts: bill.debts.map((d) => (match(d) ? { ...d, settled: true } : d)),
        };
      });
      const pair = prev.pairs.find(
        (p) =>
          idSet.size &&
          prev.bills.some(
            (b) =>
              idSet.has(b.id) &&
              p.creatorId === b.createdBy &&
              p.memberNames.includes(from),
          ),
      );
      const actor = pair ? pair.memberNames.join(" & ") : from;
      return {
        ...prev,
        bills,
        notifications: [
          {
            id: crypto.randomUUID(),
            text: `${actor} paid ${to} · SGD ${amount.toFixed(2)}`,
            createdAt: new Date().toISOString(),
            read: false,
            forName: to,
          },
          ...prev.notifications,
        ],
        toast: `${actor} paid ${to} · SGD ${amount.toFixed(2)}`,
      };
    });
  }, []);

  const captureInbox = useCallback((label: string) => {
    setState((prev) => ({
      ...prev,
      inbox: [
        {
          id: crypto.randomUUID(),
          label: label || "Receipt",
          capturedAt: new Date().toISOString(),
          processed: false,
          ocrKey: "bill-3",
          ownerId: prev.currentUserId,
        },
        ...prev.inbox,
      ],
    }));
  }, []);

  const markNotificationRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.forName === currentUser.name || prev.users.find((u) => u.id === prev.currentUserId)?.superUser
          ? { ...n, read: true }
          : n,
      ),
    }));
  }, [currentUser.name]);

  const clearToast = useCallback(() => {
    setState((prev) => ({ ...prev, toast: null }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      currentUser,
      setCurrentUser,
      setProfile,
      addContact,
      combinePayees,
      uncombinePayees,
      saveBill,
      settlePair,
      undoPair,
      portalPay,
      captureInbox,
      markNotificationRead,
      clearToast,
    }),
    [
      state,
      currentUser,
      setCurrentUser,
      setProfile,
      addContact,
      combinePayees,
      uncombinePayees,
      saveBill,
      settlePair,
      undoPair,
      portalPay,
      captureInbox,
      markNotificationRead,
      clearToast,
    ],
  );

  return <MockContext.Provider value={value}>{children}</MockContext.Provider>;
}

export function useMock() {
  const ctx = useContext(MockContext);
  if (!ctx) throw new Error("useMock must be used within MockProvider");
  return ctx;
}

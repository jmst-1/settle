"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { computeDebts } from "@/lib/debts";
import { matchRosterName } from "@/lib/me";
import { SEED_BILLS, SEED_CONTACTS, SEED_INBOX, SUPER_USER_ID, USERS } from "@/lib/mock-data";
import type { AppNotification, Bill, Contact, InboxReceipt, Member } from "@/lib/types";

type MockState = {
  users: Member[];
  contacts: Contact[];
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
  saveBill: (bill: Omit<Bill, "debts" | "lockedAt">, inboxId?: string) => void;
  settlePair: (from: string, to: string, creatorId: string) => void;
  undoPair: (from: string, to: string, creatorId: string) => void;
  portalPay: (from: string, to: string, billIds: string[]) => void;
  captureInbox: (label: string) => void;
  markNotificationRead: () => void;
  clearToast: () => void;
};

const MockContext = createContext<MockStore | null>(null);

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
    ),
  };
}

export function MockProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockState>({
    users: USERS,
    contacts: SEED_CONTACTS,
    currentUserId: SUPER_USER_ID,
    bills: SEED_BILLS,
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
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === prev.currentUserId ? { ...u, name, paynow } : u,
      ),
      contacts: prev.contacts.map((c) =>
        c.creatorId === prev.currentUserId && c.name === currentUser.name
          ? { ...c, name, paynow }
          : c,
      ),
    }));
  }, [currentUser.name]);

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

  const saveBill = useCallback((bill: Omit<Bill, "debts" | "lockedAt">, inboxId?: string) => {
    setState((prev) => ({
      ...prev,
      bills: [withDebts(bill), ...prev.bills],
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
        const hit = bill.debts.some(
          (d) =>
            (d.from === from && d.to === to) || (d.from === to && d.to === from),
        );
        return {
          ...bill,
          lockedAt: hit ? bill.lockedAt || new Date().toISOString() : bill.lockedAt,
          debts: bill.debts.map((d) => {
            const match =
              (d.from === from && d.to === to) || (d.from === to && d.to === from);
            return match ? { ...d, settled: true } : d;
          }),
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
            const match =
              (d.from === from && d.to === to) || (d.from === to && d.to === from);
            return match ? { ...d, settled: false } : d;
          }),
        };
      }),
      toast: `Reopened ${from} ↔ ${to}`,
    }));
  }, []);

  const portalPay = useCallback((from: string, to: string, billIds: string[]) => {
    const idSet = new Set(billIds);
    setState((prev) => {
      const amount = prev.bills
        .filter((b) => idSet.has(b.id))
        .flatMap((b) => b.debts)
        .filter((d) => d.from === from && d.to === to && !d.settled)
        .reduce((s, d) => s + d.amount, 0);
      return {
        ...prev,
        bills: prev.bills.map((bill) => {
          if (!idSet.has(bill.id)) return bill;
          const hit = bill.debts.some((d) => d.from === from && d.to === to && !d.settled);
          return {
            ...bill,
            lockedAt: hit ? bill.lockedAt || new Date().toISOString() : bill.lockedAt,
            debts: bill.debts.map((d) =>
              d.from === from && d.to === to ? { ...d, settled: true } : d,
            ),
          };
        }),
        notifications: [
          {
            id: crypto.randomUUID(),
            text: `${from} paid ${to} · SGD ${amount.toFixed(2)}`,
            createdAt: new Date().toISOString(),
            read: false,
            forName: to,
          },
          ...prev.notifications,
        ],
        toast: `${from} paid ${to} · SGD ${amount.toFixed(2)}`,
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

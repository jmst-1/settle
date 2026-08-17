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
import { OWNER_NAME, SEED_BILLS, SEED_INBOX } from "@/lib/mock-data";
import type { AppNotification, Bill, InboxReceipt } from "@/lib/types";

type MockState = {
  ownerName: string;
  defaultPaynow: string;
  bills: Bill[];
  inbox: InboxReceipt[];
  notifications: AppNotification[];
  toast: string | null;
};

type MockStore = MockState & {
  setProfile: (name: string, paynow: string) => void;
  saveBill: (bill: Omit<Bill, "debts" | "lockedAt">, inboxId?: string) => void;
  settlePair: (from: string, to: string) => void;
  undoPair: (from: string, to: string) => void;
  portalPay: (from: string, to: string) => void;
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
    ownerName: OWNER_NAME,
    defaultPaynow: "+6591110001",
    bills: SEED_BILLS,
    inbox: SEED_INBOX,
    notifications: [],
    toast: null,
  });

  const setProfile = useCallback((name: string, paynow: string) => {
    setState((prev) => ({ ...prev, ownerName: name, defaultPaynow: paynow }));
  }, []);

  const saveBill = useCallback((bill: Omit<Bill, "debts" | "lockedAt">, inboxId?: string) => {
    setState((prev) => ({
      ...prev,
      bills: [withDebts(bill), ...prev.bills],
      inbox: inboxId
        ? prev.inbox.map((r) => (r.id === inboxId ? { ...r, processed: true } : r))
        : prev.inbox,
    }));
  }, []);

  const settlePair = useCallback((from: string, to: string) => {
    setState((prev) => ({
      ...prev,
      bills: prev.bills.map((bill) => ({
        ...bill,
        lockedAt: bill.debts.some(
          (d) =>
            (d.from === from && d.to === to) || (d.from === to && d.to === from),
        )
          ? bill.lockedAt || new Date().toISOString()
          : bill.lockedAt,
        debts: bill.debts.map((d) => {
          const match =
            (d.from === from && d.to === to) || (d.from === to && d.to === from);
          return match ? { ...d, settled: true } : d;
        }),
      })),
      toast: `Marked ${from} → ${to} as paid`,
    }));
  }, []);

  const undoPair = useCallback((from: string, to: string) => {
    setState((prev) => ({
      ...prev,
      bills: prev.bills.map((bill) => ({
        ...bill,
        debts: bill.debts.map((d) => {
          const match =
            (d.from === from && d.to === to) || (d.from === to && d.to === from);
          return match ? { ...d, settled: false } : d;
        }),
      })),
      toast: `Reopened ${from} ↔ ${to}`,
    }));
  }, []);

  const portalPay = useCallback((from: string, to: string) => {
    setState((prev) => {
      const amount = prev.bills
        .flatMap((b) => b.debts)
        .filter((d) => d.from === from && d.to === to && !d.settled)
        .reduce((s, d) => s + d.amount, 0);
      return {
        ...prev,
        bills: prev.bills.map((bill) => ({
          ...bill,
          lockedAt: bill.debts.some((d) => d.from === from && d.to === to && !d.settled)
            ? bill.lockedAt || new Date().toISOString()
            : bill.lockedAt,
          debts: bill.debts.map((d) =>
            d.from === from && d.to === to ? { ...d, settled: true } : d,
          ),
        })),
        notifications: [
          {
            id: crypto.randomUUID(),
            text: `${from} paid ${to} · SGD ${amount.toFixed(2)}`,
            createdAt: new Date().toISOString(),
            read: false,
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
        },
        ...prev.inbox,
      ],
    }));
  }, []);

  const markNotificationRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, []);

  const clearToast = useCallback(() => {
    setState((prev) => ({ ...prev, toast: null }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      setProfile,
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
      setProfile,
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

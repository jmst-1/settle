"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  AppNotification,
  Bill,
  Contact,
  Group,
  InboxReceipt,
  Member,
} from "@/lib/types";

export type AppState = {
  users: Member[];
  contacts: Contact[];
  groups: Group[];
  currentUser: Member;
  bills: Bill[];
  inbox: InboxReceipt[];
  notifications: AppNotification[];
  toast: string | null;
  loading: boolean;
};

type AppStore = AppState & {
  refresh: () => Promise<void>;
  setProfile: (name: string, paynow: string) => Promise<void>;
  addContact: (name: string, paynow?: string) => Promise<Contact>;
  saveBill: (
    bill: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id"> & { id?: string },
    inboxId?: string,
  ) => Promise<void>;
  updateBill: (
    id: string,
    bill: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id">,
  ) => Promise<void>;
  settlePair: (from: string, to: string, creatorId: string) => Promise<void>;
  undoPair: (from: string, to: string, creatorId: string) => Promise<void>;
  captureInbox: (label: string, imagePath?: string) => Promise<void>;
  markNotificationRead: () => Promise<void>;
  createGroup: (name: string) => Promise<void>;
  addGroupMember: (groupId: string, name: string, paynow?: string) => Promise<void>;
  claimToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  clearToast: () => void;
};

const AppContext = createContext<AppStore | null>(null);

const emptyUser: Member = {
  id: "",
  name: "",
  shareToken: "",
  paynow: "",
  paynowType: "mobile",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const publicPage = pathname.startsWith("/login") || pathname.startsWith("/settle/");
  const [state, setState] = useState<AppState>({
    users: [],
    contacts: [],
    groups: [],
    currentUser: emptyUser,
    bills: [],
    inbox: [],
    notifications: [],
    toast: null,
    loading: !publicPage,
  });
  const seenNotif = useRef<string | null>(null);

  const apply = useCallback((data: Partial<AppState> & { currentUser?: Member }, toast?: string) => {
    setState((prev) => {
      const nextNotes = data.notifications ?? prev.notifications;
      const newest = nextNotes.find((n) => !n.read);
      if (newest && seenNotif.current && newest.id !== seenNotif.current && newest.text) {
        return {
          ...prev,
          ...data,
          toast: toast ?? newest.text,
        };
      }
      if (newest) seenNotif.current = newest.id;
      return { ...prev, ...data, loading: false, toast: toast ?? prev.toast };
    });
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state");
    if (res.status === 401) {
      if (!publicPage) router.replace("/login");
      setState((p) => ({ ...p, loading: false }));
      return;
    }
    if (!res.ok) {
      setState((p) => ({ ...p, loading: false }));
      return;
    }
    const data = (await res.json()) as Omit<AppState, "toast" | "loading">;
    apply({ ...data, loading: false });
  }, [apply, publicPage, router]);

  useEffect(() => {
    if (publicPage) {
      setState((p) => ({ ...p, loading: false }));
      return;
    }
    void refresh();
  }, [publicPage, refresh]);

  useEffect(() => {
    if (publicPage || state.loading || !state.currentUser.id) return;
    const claim = new URLSearchParams(window.location.search).get("claim");
    const withClaim = (path: string) =>
      claim ? `${path}?claim=${encodeURIComponent(claim)}` : path;
    if (!state.currentUser.onboardedAt && pathname !== "/welcome") {
      router.replace(withClaim("/welcome"));
      return;
    }
    if (state.currentUser.onboardedAt && pathname === "/welcome") {
      router.replace(withClaim("/"));
    }
  }, [pathname, publicPage, router, state.currentUser.id, state.currentUser.onboardedAt, state.loading]);

  useEffect(() => {
    if (publicPage) return;
    const sb = createClient();
    if (sb) {
      const ch = sb
        .channel("splittab-notifications")
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
          void refresh();
        })
        .subscribe();
      return () => {
        void sb.removeChannel(ch);
      };
    }
    const t = setInterval(() => void refresh(), 8000);
    return () => clearInterval(t);
  }, [publicPage, refresh]);

  const post = useCallback(
    async (url: string, body: unknown, toast?: string) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      if (data.currentUser) apply(data, toast);
      else await refresh();
      return data;
    },
    [apply, refresh],
  );

  const setProfile = useCallback(
    async (name: string, paynow: string) => {
      await post("/api/profile", { name, paynow });
    },
    [post],
  );

  const addContact = useCallback(
    async (name: string, paynow = "") => {
      const existing = state.contacts.find(
        (c) => c.creatorId === state.currentUser.id && c.name.toLowerCase() === name.trim().toLowerCase(),
      );
      if (existing) return existing;
      const data = await post("/api/groups", { action: "add-contact", name, paynow });
      const created = (data.contacts as Contact[] | undefined)?.find(
        (c) => c.creatorId === state.currentUser.id && c.name.toLowerCase() === name.trim().toLowerCase(),
      );
      return created ?? { id: "", creatorId: state.currentUser.id, groupId: "", name, paynow, shareToken: "" };
    },
    [post, state.contacts, state.currentUser.id],
  );

  const saveBill = useCallback(
    async (bill: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id"> & { id?: string }, inboxId?: string) => {
      await post("/api/bills", { ...bill, inboxId });
    },
    [post],
  );

  const updateBill = useCallback(
    async (id: string, bill: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id">) => {
      const res = await fetch(`/api/bills/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bill),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update");
      await refresh();
    },
    [refresh],
  );

  const settlePair = useCallback(
    async (from: string, to: string, creatorId: string) => {
      await post("/api/settle", { action: "tag", from, to, creatorId }, `Marked ${from} → ${to} as paid`);
    },
    [post],
  );

  const undoPair = useCallback(
    async (from: string, to: string, creatorId: string) => {
      await post("/api/settle", { action: "undo", from, to, creatorId }, `Reopened ${from} ↔ ${to}`);
    },
    [post],
  );

  const captureInbox = useCallback(
    async (label: string, imagePath?: string) => {
      await post("/api/inbox", { label, imagePath });
    },
    [post],
  );

  const markNotificationRead = useCallback(async () => {
    await post("/api/settle", { action: "read" });
  }, [post]);

  const createGroup = useCallback(
    async (name: string) => {
      await post("/api/groups", { action: "create", name });
    },
    [post],
  );

  const addGroupMember = useCallback(
    async (groupId: string, name: string, paynow?: string) => {
      await post("/api/groups", { action: "add-member", groupId, name, paynow });
    },
    [post],
  );

  const claimToken = useCallback(
    async (token: string) => {
      await post("/api/auth/claim", { token });
    },
    [post],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }, [router]);

  const clearToast = useCallback(() => {
    setState((prev) => ({ ...prev, toast: null }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      setProfile,
      addContact,
      saveBill,
      updateBill,
      settlePair,
      undoPair,
      captureInbox,
      markNotificationRead,
      createGroup,
      addGroupMember,
      claimToken,
      logout,
      clearToast,
    }),
    [
      state,
      refresh,
      setProfile,
      addContact,
      saveBill,
      updateBill,
      settlePair,
      undoPair,
      captureInbox,
      markNotificationRead,
      createGroup,
      addGroupMember,
      claimToken,
      logout,
      clearToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

/** @deprecated use useApp */
export function useMock() {
  return useApp();
}

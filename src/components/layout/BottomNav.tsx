"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Receipt, Zap } from "lucide-react";
import { useMock } from "@/context/MockStore";

const TABS = [
  { href: "/", id: "bills", label: "Bills", icon: Receipt },
  { href: "/inbox", id: "inbox", label: "Inbox", icon: Inbox },
  { href: "/settle", id: "settle", label: "Settle", icon: Zap },
];

export function BottomNav() {
  const pathname = usePathname();
  const { inbox, notifications } = useMock();
  const inboxCount = inbox.filter((r) => !r.processed).length;
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-[#111009] pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const active =
          tab.href === "/"
            ? pathname === "/"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        const badge = tab.id === "inbox" ? inboxCount : tab.id === "settle" ? unread : 0;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 pb-3"
          >
            {active && (
              <span className="absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 rounded-full bg-accent" />
            )}
            <Icon size={20} className={active ? "text-accent" : "text-[#3A3632]"} />
            <span
              className={`text-[10px] font-bold tracking-wide ${active ? "text-accent" : "text-[#3A3632]"}`}
            >
              {tab.label}
            </span>
            {badge > 0 && (
              <span className="absolute right-[calc(50%-14px)] top-2 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-extrabold text-white">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

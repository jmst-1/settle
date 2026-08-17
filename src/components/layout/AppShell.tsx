"use client";

import { usePathname, useRouter } from "next/navigation";
import { Camera, Inbox, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { useApp } from "@/context/AppStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, currentUser } = useApp();
  const hideChrome =
    pathname.startsWith("/login") ||
    pathname.startsWith("/settle/") ||
    pathname.startsWith("/bills/new") ||
    pathname.includes("/edit");
  const publicPage = pathname.startsWith("/login") || pathname.startsWith("/settle/");

  if (!publicPage && (loading || !currentUser.id)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[4px] text-accent">SplitTab</div>
          <div className="text-sm text-muted">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {!hideChrome && (
        <>
          <Fab />
          <BottomNav />
        </>
      )}
      <Toast />
    </>
  );
}

function Toast() {
  const { toast, clearToast } = useApp();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 3200);
    return () => clearTimeout(t);
  }, [toast, clearToast]);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[300] w-[calc(100%-32px)] max-w-[400px] -translate-x-1/2">
      <div
        className="rounded-2xl border border-accent/25 bg-card px-4 py-3 text-sm font-semibold text-accent shadow-lg"
        style={{ animation: "toast-in 0.2s ease-out" }}
      >
        {toast}
      </div>
    </div>
  );
}

function Fab() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[76px] right-[max(24px,calc(50%-430px/2+24px))] z-50 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_rgba(196,69,45,0.32)]"
        aria-label="New bill"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4">
          <button className="absolute inset-0" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="relative mb-[72px] w-full max-w-[420px] rounded-[20px] border border-border bg-card p-5">
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-black/10" />
            {[
              {
                icon: Camera,
                label: "Scan & split now",
                sub: "Photo a receipt and assign immediately",
                href: "/bills/new?mode=scan",
                primary: true,
              },
              {
                icon: Inbox,
                label: "Save to inbox",
                sub: "Capture now, split later",
                href: "/inbox?capture=1",
              },
              {
                icon: Pencil,
                label: "Enter manually",
                sub: "Type items and amounts by hand",
                href: "/bills/new?mode=manual",
              },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.label}
                  onClick={() => {
                    setOpen(false);
                    router.push(opt.href);
                  }}
                  className={`mb-2.5 flex w-full items-center gap-4 rounded-[14px] p-[15px] text-left last:mb-0 ${
                    opt.primary
                      ? "border border-accent/20 bg-accent/10"
                      : "border border-border bg-card-2"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      opt.primary ? "bg-accent/15 text-accent" : "bg-black/[0.04] text-dim"
                    }`}
                  >
                    <Icon size={20} />
                  </span>
                  <span>
                    <span className="mb-0.5 block text-[15px] font-extrabold">{opt.label}</span>
                    <span className="text-xs text-muted">{opt.sub}</span>
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setOpen(false)}
              className="mt-1 flex w-full items-center justify-center gap-1 py-2 text-sm text-muted"
            >
              <X size={14} /> Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

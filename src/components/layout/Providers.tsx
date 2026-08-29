"use client";

import { AppProvider } from "@/context/AppStore";
import { AppShell } from "@/components/layout/AppShell";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="mx-auto min-h-dvh max-w-[430px] bg-bg shadow-[0_0_60px_rgba(28,25,23,0.12)]">
        <AppShell>{children}</AppShell>
      </div>
    </AppProvider>
  );
}

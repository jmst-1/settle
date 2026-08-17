"use client";

import { MockProvider } from "@/context/MockStore";
import { AppShell, MockupBar } from "@/components/layout/AppShell";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MockProvider>
      <div className="mx-auto min-h-dvh max-w-[430px] bg-bg shadow-[0_0_60px_rgba(28,25,23,0.12)]">
        <MockupBar />
        <AppShell>{children}</AppShell>
      </div>
    </MockProvider>
  );
}

"use client";

import { ChevronLeft } from "lucide-react";

export function Amt({
  value,
  color,
  size = 14,
}: {
  value: number;
  color?: string;
  size?: number;
}) {
  const str = Number(value).toFixed(2);
  const [int, dec] = str.split(".");
  return (
    <span
      className="font-mono font-bold tracking-tight"
      style={{ color: color || "var(--text)", fontSize: size }}
    >
      {int}
      <span style={{ opacity: 0.45, fontSize: size * 0.82 }}>.{dec}</span>
    </span>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted">
      {children}
    </div>
  );
}

export function Perf() {
  return <div className="perf" />;
}

export function SectionHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-b from-card to-transparent px-5 pb-4 pt-6">
      <div className="flex items-start gap-3">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-text shadow-sm"
          >
            <ChevronLeft size={20} strokeWidth={2.25} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && (
            <div className="mt-1 font-mono text-xs text-muted">{subtitle}</div>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

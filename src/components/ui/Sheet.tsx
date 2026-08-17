"use client";

import { X } from "lucide-react";

export function Sheet({
  children,
  onClose,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <button className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-[20px] border border-border bg-card p-6">
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-black/10 sm:hidden" />
        {(title || subtitle) && (
          <div className="mb-4 pr-8">
            {title && <div className="text-[16px] font-extrabold">{title}</div>}
            {subtitle && <div className="mt-1 text-[13px] text-muted">{subtitle}</div>}
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-dim"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} subtitle={body} onClose={onClose}>
      <div className="flex gap-2.5">
        <button onClick={onClose} className="btn-ghost flex-1">
          Cancel
        </button>
        <button onClick={onConfirm} className="btn-primary flex-[2]">
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

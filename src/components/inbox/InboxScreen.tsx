"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Check, ImageIcon, Utensils } from "lucide-react";
import { Label, Perf } from "@/components/ui/Typography";
import { ConfirmSheet, Sheet } from "@/components/ui/Sheet";
import { useApp } from "@/context/AppStore";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import type { CardTransaction } from "@/lib/types";

export function InboxScreen() {
  const {
    inbox,
    captureInbox,
    currentUser,
    transactions,
    bills,
    actOnTransaction,
    markSuggestedRead,
  } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const unprocessed = inbox.filter((r) => !r.processed && r.ownerId === currentUser.id);
  const pending = transactions.filter((t) => t.status === "pending" && t.ownerId === currentUser.id);
  const [capture, setCapture] = useState(false);
  const [scanTxn, setScanTxn] = useState<CardTransaction | null>(null);
  const [linkTxn, setLinkTxn] = useState<CardTransaction | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [combineConfirm, setCombineConfirm] = useState(false);

  useEffect(() => {
    if (params.get("capture") === "1") setCapture(true);
  }, [params]);

  useEffect(() => {
    if (pending.length) void markSuggestedRead();
  }, [pending.length, markSuggestedRead]);

  const selectable = unprocessed.length >= 2;
  const selectedReceipts = unprocessed.filter((r) => selected.includes(r.id));
  const waiting = pending.length + unprocessed.length;
  const myBills = bills.filter((b) => b.createdBy === currentUser.id).slice(0, 12);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className={selected.length >= 2 ? "pb-40" : "pb-28"}>
      <div className="px-5 pb-4 pt-7">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[4px] text-accent">
          SplitTab
        </div>
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Inbox</h1>
        <div className="mt-1 text-[13px] text-dim">{currentUser.name}&apos;s captures</div>
        {waiting > 0 && (
          <div className="mt-1 text-[13px] text-muted">
            {waiting} waiting to split
            {selectable ? " · tap receipts to combine" : ""}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-5">
        {pending.map((t) => {
          const suggested = t.matchedBillId ? bills.find((b) => b.id === t.matchedBillId) : undefined;
          return (
            <div key={t.id} className="card">
              <div className="flex items-center gap-3.5 px-4 py-3.5">
                <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] border border-border bg-card-2 text-accent">
                  <Utensils size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{t.merchant}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">
                    {fmtMoney(t.amount, t.currency)} · {fmtDate(t.txnDate)}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-warn">
                  Split?
                </span>
              </div>
              <Perf />
              <div className="p-4">
                <p className="mb-3 text-[13px] text-dim">
                  {suggested
                    ? `Looks like your ${suggested.occasion} bill — link it, or scan a receipt?`
                    : "Split expense detected. Scan a receipt?"}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setScanTxn(t)}
                    className="btn-primary py-2.5 text-sm"
                  >
                    Scan receipt
                  </button>
                  <button
                    onClick={() => router.push(`/bills/new?mode=alert&txn=${t.id}`)}
                    className="btn-ghost py-2.5 text-sm"
                  >
                    Split without photo
                  </button>
                  {suggested ? (
                    <button
                      onClick={() => void actOnTransaction(t.id, "match", suggested.id)}
                      className="btn-ghost py-2.5 text-sm"
                    >
                      Link existing bill
                    </button>
                  ) : (
                    <button onClick={() => setLinkTxn(t)} className="btn-ghost py-2.5 text-sm">
                      This is an existing bill
                    </button>
                  )}
                  <button
                    onClick={() => void actOnTransaction(t.id, "dismiss")}
                    className="btn-ghost py-2.5 text-sm text-muted"
                  >
                    Not for splitting
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {unprocessed.length === 0 && pending.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mb-3 text-[17px] font-bold">Inbox empty</div>
            <p className="text-[13px] text-muted">Capture a receipt to process later</p>
          </div>
        ) : (
          unprocessed.map((r) => {
            const on = selected.includes(r.id);
            return (
              <div
                key={r.id}
                className="card"
                style={on ? { borderColor: "rgba(196,69,45,0.45)" } : undefined}
              >
                <div className="flex items-center gap-3.5 px-4 py-3.5">
                  {selectable && (
                    <button
                      onClick={() => toggle(r.id)}
                      aria-label={on ? "Deselect receipt" : "Select receipt"}
                      aria-pressed={on}
                      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: on ? "var(--accent)" : "transparent",
                        border: `1.5px solid ${on ? "var(--accent)" : "rgba(28,25,23,0.2)"}`,
                        color: "white",
                      }}
                    >
                      {on && <Check size={12} strokeWidth={3} />}
                    </button>
                  )}
                  <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] border border-border bg-card-2 text-accent">
                    <ImageIcon size={22} />
                  </div>
                  <button
                    type="button"
                    onClick={() => (selectable ? toggle(r.id) : undefined)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-bold">{r.label}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted">
                      {fmtDateTime(r.capturedAt)}
                    </div>
                  </button>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-warn">
                    Pending
                  </span>
                </div>
                <Perf />
                <div className="p-4">
                  <button
                    onClick={() => router.push(`/bills/new?mode=inbox&rx=${r.id}`)}
                    className="btn-primary py-2.5 text-sm"
                  >
                    Process
                  </button>
                </div>
              </div>
            );
          })
        )}
        <button onClick={() => setCapture(true)} className="btn-ghost mt-1">
          Capture new receipt
        </button>
      </div>

      {selected.length >= 2 && (
        <div className="fixed inset-x-0 bottom-[72px] z-[80] mx-auto w-full max-w-[430px] px-5">
          <button onClick={() => setCombineConfirm(true)} className="btn-primary shadow-lg">
            Combine & split ({selected.length})
          </button>
        </div>
      )}

      {combineConfirm && (
        <ConfirmSheet
          title="Split as one bill?"
          body={`Combine ${selectedReceipts.map((r) => r.label).join(" + ")} into one expense. Same people, one split.`}
          confirmLabel={`Combine ${selected.length} receipts`}
          onClose={() => setCombineConfirm(false)}
          onConfirm={() => {
            router.push(`/bills/new?mode=combine&rx=${selected.join(",")}`);
          }}
        />
      )}

      {(capture || scanTxn) && (
        <CaptureModal
          title={scanTxn ? "Scan receipt" : "Capture receipt"}
          subtitle={scanTxn ? `${fmtMoney(scanTxn.amount)} at ${scanTxn.merchant}` : "Save now, split later"}
          defaultLabel={scanTxn?.merchant}
          onClose={() => {
            setCapture(false);
            setScanTxn(null);
            router.replace("/inbox");
          }}
          onSave={async (label, imagePath) => {
            const id = await captureInbox(label, imagePath);
            const txn = scanTxn;
            setCapture(false);
            setScanTxn(null);
            if (txn) {
              router.replace(
                `/bills/new?mode=alert&txn=${txn.id}${id ? `&rx=${id}` : ""}`,
              );
            } else {
              router.replace("/inbox");
            }
          }}
        />
      )}

      {linkTxn && (
        <Sheet
          title="Link to a bill"
          subtitle={`Match ${fmtMoney(linkTxn.amount)} at ${linkTxn.merchant}`}
          onClose={() => setLinkTxn(null)}
        >
          {myBills.length === 0 ? (
            <p className="text-[13px] text-muted">No bills yet.</p>
          ) : (
            <div className="flex max-h-[50vh] flex-col gap-2 overflow-auto">
              {myBills.map((b) => (
                <button
                  key={b.id}
                  className="btn-ghost py-2.5 text-left text-sm"
                  onClick={async () => {
                    await actOnTransaction(linkTxn.id, "match", b.id);
                    setLinkTxn(null);
                  }}
                >
                  <div className="font-bold">{b.occasion}</div>
                  <div className="text-[11px] text-muted">
                    {fmtMoney(b.receiptTotal, b.currency)} · {fmtDate(b.billDate)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function CaptureModal({
  onSave,
  onClose,
  title = "Capture receipt",
  subtitle = "Save now, split later",
  defaultLabel = "",
}: {
  onSave: (label: string, imagePath?: string) => Promise<void>;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  defaultLabel?: string;
}) {
  const [label, setLabel] = useState(defaultLabel);
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPath(data.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <button
        onClick={!path && !busy ? () => cameraRef.current?.click() : undefined}
        className={`mb-3 flex w-full flex-col items-center gap-2 rounded-[14px] border-2 border-dashed px-8 py-8 ${
          path ? "border-ok/40 bg-ok/5" : "border-border bg-card-2"
        }`}
      >
        <Camera size={28} className={path ? "text-ok" : "text-dim"} />
        <div className={`text-sm font-bold ${path ? "text-ok" : "text-dim"}`}>
          {path ? "Receipt captured" : busy ? "Uploading…" : "Take photo"}
        </div>
        <div className="text-xs text-muted">Camera or photo library</div>
      </button>
      <button onClick={() => libraryRef.current?.click()} className="btn-ghost mb-4 py-2.5 text-sm">
        <ImageIcon size={14} className="mr-1 inline" /> Photo library
      </button>
      {error && <div className="mb-3 text-[13px] text-danger">{error}</div>}
      <Label>
        Label <span className="font-normal normal-case tracking-normal text-muted">(optional)</span>
      </Label>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Dinner at Lavo"
        className="field mt-2 mb-5"
      />
      <div className="flex gap-2.5">
        <button onClick={onClose} className="btn-ghost flex-1">
          Cancel
        </button>
        <button
          onClick={() => void onSave(label, path || undefined)}
          disabled={!path}
          className="btn-primary flex-[2] py-3 text-sm"
        >
          Save to inbox
        </button>
      </div>
    </Sheet>
  );
}

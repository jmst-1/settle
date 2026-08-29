"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ImageIcon, ListFilter, Pencil, Plus } from "lucide-react";
import { Amt, Label, Perf, SectionHeader } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmSheet, Sheet } from "@/components/ui/Sheet";
import { nameColor } from "@/lib/colors";
import { useApp } from "@/context/AppStore";
import { expandOcr } from "@/lib/ocr";
import { matchRosterName, rosterFor } from "@/lib/me";
import type { Bill, BillItem, BillReceipt, InboxReceipt, OcrResult } from "@/lib/types";

type DraftReceipt = BillReceipt & { inboxId?: string };
type Step = "upload" | "review" | "people" | "assign";

function newId() {
  return crypto.randomUUID();
}

function emptyItem(receiptId: string): BillItem {
  return { name: "", price: 0, assignee: null, split: false, splitWith: [], receiptId };
}

function draftFromOcr(
  ocr: OcrResult,
  label: string,
  inboxId?: string,
): { receipt: DraftReceipt; items: BillItem[] } {
  const id = newId();
  return {
    receipt: {
      id,
      label: label || ocr.occasion || "Receipt",
      billDate: ocr.bill_date || new Date().toISOString().slice(0, 10),
      discount: ocr.discount || 0,
      serviceCharge: ocr.serviceCharge || 0,
      tax: ocr.tax || 0,
      receiptTotal: ocr.total || 0,
      inboxId,
    },
    items: expandOcr(ocr, id),
  };
}

function blankDraft(): { receipt: DraftReceipt; items: BillItem[] } {
  const id = newId();
  return {
    receipt: {
      id,
      label: "Receipt",
      billDate: new Date().toISOString().slice(0, 10),
      discount: 0,
      serviceCharge: 0,
      tax: 0,
      receiptTotal: 0,
    },
    items: [emptyItem(id)],
  };
}

function draftsFromBill(bill: Bill): { receipt: DraftReceipt; items: BillItem[] }[] {
  if (bill.receipts && bill.receipts.length > 0) {
    return bill.receipts.map((receipt) => ({
      receipt,
      items: bill.items.filter((it) => it.receiptId === receipt.id),
    }));
  }
  const id = bill.id;
  return [
    {
      receipt: {
        id,
        label: bill.occasion,
        billDate: bill.billDate,
        discount: bill.discount,
        serviceCharge: bill.serviceCharge,
        tax: bill.tax,
        receiptTotal: bill.receiptTotal,
      },
      items: bill.items.map((it) => ({ ...it, receiptId: it.receiptId || id })),
    },
  ];
}

function samePeople(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((n) => set.has(n));
}

function isEqualSplit(items: BillItem[], names: string[]) {
  return (
    items.length > 0 &&
    items.every((it) => it.split && !it.assignee && samePeople(it.splitWith, names))
  );
}

function loadInboxDrafts(sources: InboxReceipt[]) {
  return sources.map((rx) => {
    if (rx.ocr) return draftFromOcr(rx.ocr, rx.label || rx.ocr.occasion, rx.id);
    const blank = blankDraft();
    blank.receipt.inboxId = rx.id;
    blank.receipt.label = rx.label || blank.receipt.label;
    return blank;
  });
}

export function NewBillWizard({ editBill }: { editBill?: Bill }) {
  const router = useRouter();
  const params = useSearchParams();
  const { saveBill, updateBill, currentUser, contacts, addContact, inbox } = useApp();
  const mode = params.get("mode") || "scan";
  const rxIds = (params.get("rx") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const sourceReceipts = rxIds
    .map((id) => inbox.find((r) => r.id === id))
    .filter((r): r is InboxReceipt => Boolean(r));

  const initialDrafts = editBill
    ? draftsFromBill(editBill)
    : sourceReceipts.length > 0
      ? loadInboxDrafts(sourceReceipts)
      : mode === "manual"
        ? [blankDraft()]
        : [];

  const labels = sourceReceipts.map((r) => r.label).filter(Boolean);
  const sameLabel = labels.length > 0 && labels.every((l) => l === labels[0]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const addCameraRef = useRef<HTMLInputElement>(null);
  const addLibraryRef = useRef<HTMLInputElement>(null);
  const [ocrError, setOcrError] = useState("");

  const [step, setStep] = useState<Step>(
    initialDrafts.length || editBill ? "review" : mode === "manual" ? "review" : "upload",
  );
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(sourceReceipts.length > 0 || Boolean(editBill));
  const [occasion, setOccasion] = useState(
    editBill?.occasion ||
      (sameLabel ? labels[0] : sourceReceipts[0]?.label || sourceReceipts[0]?.ocr?.occasion || ""),
  );
  const [billDate, setBillDate] = useState(() => {
    if (editBill?.billDate) return editBill.billDate;
    const dates = initialDrafts.map((d) => d.receipt.billDate).filter(Boolean).sort();
    return dates[0] || new Date().toISOString().slice(0, 10);
  });
  const [receipts, setReceipts] = useState<DraftReceipt[]>(initialDrafts.map((d) => d.receipt));
  const [items, setItems] = useState<BillItem[]>(initialDrafts.flatMap((d) => d.items));
  const [names, setNames] = useState<string[]>(editBill?.names ?? [currentUser.name]);
  const [newName, setNewName] = useState("");
  const [paidBy, setPaidBy] = useState(editBill?.paidBy || currentUser.name);
  const [payNow, setPayNow] = useState(editBill?.payNowNumber || currentUser.paynow);
  const [equalConfirm, setEqualConfirm] = useState(false);
  const [splitPicker, setSplitPicker] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const roster = rosterFor(contacts, currentUser.id);
  const recent = roster.map((c) => c.name);
  const itemSubtotal = items.reduce((s, it) => s + it.price, 0);
  const discount = receipts.reduce((s, r) => s + r.discount, 0);
  const sc = receipts.reduce((s, r) => s + r.serviceCharge, 0);
  const tax = receipts.reduce((s, r) => s + r.tax, 0);
  const receiptTotal = receipts.reduce((s, r) => s + r.receiptTotal, 0);
  const sectionDerived = (r: DraftReceipt) => {
    const sub = items.filter((it) => it.receiptId === r.id).reduce((s, it) => s + it.price, 0);
    return sub - r.discount + r.serviceCharge + r.tax;
  };
  const derivedTotal = receipts.length
    ? receipts.reduce((s, r) => s + sectionDerived(r), 0)
    : itemSubtotal;
  const diff = receiptTotal > 0 ? Math.abs(receiptTotal - derivedTotal) : 0;
  const allAssigned =
    items.length > 0 && items.every((it) => (it.split && it.splitWith.length) || it.assignee);
  const perHead = names.length ? derivedTotal / names.length : 0;
  const fromInbox = sourceReceipts.length > 0;
  const combined = receipts.length > 1;

  const patchReceipt = (id: string, patch: Partial<DraftReceipt>) => {
    setReceipts((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const appendDraft = (draft: { receipt: DraftReceipt; items: BillItem[] }) => {
    setReceipts((p) => [...p, draft.receipt]);
    setItems((p) => [...p, ...draft.items]);
    setScanned(true);
    setStep("review");
    if (!occasion) setOccasion(draft.receipt.label);
    if (draft.receipt.billDate && (!billDate || draft.receipt.billDate < billDate)) {
      setBillDate(draft.receipt.billDate);
    }
  };

  const handleFile = async (file: File | undefined, append = false) => {
    if (!file) return;
    setScanning(true);
    setOcrError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: form });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || "Upload failed");
      const ocrRes = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: upData.path }),
      });
      const ocrData = await ocrRes.json();
      if (!ocrRes.ok) throw new Error(ocrData.error || "Could not read receipt");
      const ocr = ocrData.ocr as OcrResult;
      const draft = draftFromOcr(ocr, ocr.occasion);
      if (append) appendDraft(draft);
      else {
        setReceipts([draft.receipt]);
        setItems(draft.items);
        setOccasion(ocr.occasion || "");
        setBillDate(draft.receipt.billDate);
        setScanned(true);
        setStep("review");
      }
      setAdding(false);
    } catch (e) {
      setOcrError((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const persist = async (billItems: BillItem[]) => {
    const payload = {
      occasion: occasion || "Untitled bill",
      billDate,
      currency: "SGD" as const,
      items: billItems,
      names: [...names],
      discount,
      serviceCharge: sc,
      tax,
      receiptTotal: receiptTotal || derivedTotal,
      paidBy,
      payNowNumber: payNow,
      receipts: receipts.map(
        ({ id, label, billDate: date, discount: d, serviceCharge, tax: gst, receiptTotal: total }) => ({
          id,
          label,
          billDate: date,
          discount: d,
          serviceCharge,
          tax: gst,
          receiptTotal: total,
        }),
      ),
    };
    const inboxIds = receipts.map((r) => r.inboxId).filter((id): id is string => Boolean(id));
    if (editBill) await updateBill(editBill.id, payload);
    else await saveBill(payload, inboxIds);
    router.push(editBill ? `/bills/${editBill.id}` : "/");
  };

  const addName = async (n?: string) => {
    const raw = (n ?? newName).trim();
    if (!raw) return;
    const hit = matchRosterName(contacts, currentUser.id, raw);
    const name = hit?.name ?? (await addContact(raw)).name;
    if (!names.includes(name)) {
      setNames((p) => [...p, name]);
      if (!paidBy) setPaidBy(name);
    }
    setNewName("");
  };

  const steps = ["Review", "People", "Split"] as const;
  const stepIdx = step === "upload" ? -1 : step === "review" ? 0 : step === "people" ? 1 : 2;

  return (
    <div className="pb-10">
      {step !== "upload" && (
        <div className="flex gap-1.5 px-5 pt-4">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full ${i <= stepIdx ? "bg-accent" : "bg-black/10"}`} />
              <div className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider ${i === stepIdx ? "text-accent" : "text-muted"}`}>
                {s}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === "upload" && (
        <>
          <SectionHeader
            title={editBill ? "Edit bill" : "New bill"}
            subtitle="Scan or enter manually"
            onBack={() => router.push(editBill ? `/bills/${editBill.id}` : "/")}
          />
          <div className="flex flex-col gap-3.5 px-5">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0], false)}
            />
            <input
              ref={libraryRef}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0], false)}
            />
            <button
              onClick={!scanning ? () => cameraRef.current?.click() : undefined}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent/30 bg-accent/[0.04] px-8 py-10"
            >
              <Camera size={32} className="text-accent" />
              <div className="text-[15px] font-bold text-accent">
                {scanning ? "Reading receipt…" : "Take photo"}
              </div>
              {scanning ? (
                <div className="h-[3px] w-[140px] overflow-hidden rounded-sm bg-black/10">
                  <div className="h-full w-1/3 rounded-sm bg-accent" style={{ animation: "scan 1.4s ease-in-out infinite" }} />
                </div>
              ) : (
                <div className="text-[13px] text-muted">Camera captures a receipt photo</div>
              )}
            </button>
            <button onClick={() => libraryRef.current?.click()} className="btn-ghost flex items-center justify-center gap-2">
              <ImageIcon size={16} /> Photo library
            </button>
            <button
              onClick={() => {
                if (!receipts.length) {
                  const draft = blankDraft();
                  setReceipts([draft.receipt]);
                  setItems(draft.items);
                }
                setStep("review");
              }}
              className="btn-ghost flex items-center justify-center gap-2"
            >
              <Pencil size={16} /> Enter manually
            </button>
            {ocrError && (
              <div className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-[13px] text-danger">
                {ocrError}
              </div>
            )}
          </div>
        </>
      )}

      {step === "review" && (
        <>
          <SectionHeader
            title={combined ? "Review receipts" : "Review receipt"}
            subtitle={
              combined
                ? `${receipts.length} slips — one bill when you save`
                : scanned
                  ? "OCR complete — edit anything that's off"
                  : "Enter your items"
            }
            onBack={() =>
              editBill
                ? router.push(`/bills/${editBill.id}`)
                : fromInbox
                  ? router.push("/inbox")
                  : setStep("upload")
            }
          />
          <div className="flex flex-col gap-3.5 px-5">
            <div className="card">
              <div className="p-4">
                <Label>Occasion</Label>
                <input value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="e.g. Dinner at Lavo" className="field mt-2" />
              </div>
              <Perf />
              <div className="p-4">
                <Label>Date</Label>
                <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="field mt-2" />
              </div>
            </div>

            {receipts.map((receipt, ri) => {
              const sectionItems = items
                .map((it, i) => ({ it, i }))
                .filter(({ it }) => it.receiptId === receipt.id);
              const derived = sectionDerived(receipt);
              const sectionDiff =
                receipt.receiptTotal > 0 ? Math.abs(receipt.receiptTotal - derived) : 0;
              return (
                <div key={receipt.id} className="card">
                  <div className="flex items-start gap-2 px-4 pb-1.5 pt-3.5">
                    <div className="min-w-0 flex-1">
                      <Label>{combined || receipts.length > 1 ? `Receipt ${ri + 1}` : "Items"}</Label>
                      {(combined || receipts.length > 1) && (
                        <input
                          value={receipt.label}
                          onChange={(e) => patchReceipt(receipt.id, { label: e.target.value })}
                          placeholder="Slip name"
                          className="mt-2 w-full border-none bg-transparent text-sm font-bold outline-none"
                        />
                      )}
                    </div>
                    {receipts.length > 1 && (
                      <button
                        onClick={() => {
                          setReceipts((p) => p.filter((r) => r.id !== receipt.id));
                          setItems((p) => p.filter((it) => it.receiptId !== receipt.id));
                        }}
                        className="text-[13px] font-bold text-muted"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {(combined || receipts.length > 1) && (
                    <div className="px-4 pb-2">
                      <input
                        type="date"
                        value={receipt.billDate}
                        onChange={(e) => patchReceipt(receipt.id, { billDate: e.target.value })}
                        className="field"
                      />
                    </div>
                  )}
                  {sectionItems.map(({ it, i }) => (
                    <div key={i}>
                      <Perf />
                      <div className="flex items-center gap-2 px-4 py-3">
                        <input
                          value={it.name}
                          onChange={(e) =>
                            setItems((p) => p.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))
                          }
                          placeholder="Item name"
                          className="min-w-0 flex-1 border-none bg-transparent text-sm font-semibold outline-none"
                        />
                        <input
                          value={it.price || ""}
                          onChange={(e) =>
                            setItems((p) =>
                              p.map((x, idx) => (idx === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x)),
                            )
                          }
                          placeholder="0.00"
                          type="number"
                          step="0.01"
                          className="w-[72px] border-none bg-transparent text-right font-mono text-[13px] font-bold text-accent outline-none"
                        />
                        <button
                          onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                          className="text-lg text-muted"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  <Perf />
                  <div className="p-4">
                    <button
                      onClick={() => setItems((p) => [...p, emptyItem(receipt.id)])}
                      className="text-[13px] font-bold text-accent"
                    >
                      + Add item
                    </button>
                  </div>
                  <Perf />
                  {[
                    ["Bill discount", receipt.discount, "discount", "var(--ok)", true],
                    ["Service charge", receipt.serviceCharge, "serviceCharge", "var(--dim)", false],
                    ["GST", receipt.tax, "tax", "var(--dim)", false],
                  ].map(([lbl, val, key, clr, neg]) => (
                    <div key={String(key)}>
                      <div className="flex items-center gap-2 px-4 py-3">
                        <span className="flex-1 text-[13px]" style={{ color: String(clr) }}>
                          {String(lbl)}
                        </span>
                        {Boolean(neg) && <span style={{ color: String(clr) }}>−</span>}
                        <input
                          value={(val as number) || ""}
                          onChange={(e) =>
                            patchReceipt(receipt.id, {
                              [key as "discount" | "serviceCharge" | "tax"]: parseFloat(e.target.value) || 0,
                            })
                          }
                          type="number"
                          step="0.01"
                          className="w-[72px] border-none bg-transparent text-right font-mono text-[13px] font-bold outline-none"
                          style={{ color: String(clr) }}
                        />
                      </div>
                      <Perf />
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm font-bold">{receipts.length > 1 ? "Slip total" : "Total"}</span>
                    <Amt value={derived} color="var(--accent)" size={16} />
                  </div>
                  {sectionDiff > 0.01 && (
                    <div className="px-4 pb-3.5">
                      <div className="rounded-[10px] border border-warn/20 bg-warn/10 px-3 py-2 text-xs text-warn">
                        Receipt total was {receipt.receiptTotal.toFixed(2)} — differs by {sectionDiff.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {combined && diff > 0.01 && (
              <div className="rounded-[10px] border border-warn/20 bg-warn/10 px-3 py-2 text-xs text-warn">
                Combined total {derivedTotal.toFixed(2)} vs receipts {receiptTotal.toFixed(2)} — differs by {diff.toFixed(2)}
              </div>
            )}

            <button onClick={() => setAdding(true)} className="btn-ghost flex items-center justify-center gap-2">
              <Plus size={16} /> Add another receipt
            </button>
            <button onClick={() => setStep("people")} className="btn-primary">
              Continue
            </button>
          </div>
        </>
      )}

      {step === "people" && (
        <>
          <SectionHeader
            title="Who's splitting?"
            subtitle={`${items.length} items · SGD ${derivedTotal.toFixed(2)}${combined ? ` · ${receipts.length} receipts` : ""}`}
            onBack={() => setStep("review")}
          />
          <div className="flex flex-col gap-3.5 px-5">
            <div className="card">
              <div className="p-4">
                <Label>Your people</Label>
                <p className="mb-2 mt-1 text-[11px] leading-relaxed text-muted">
                  This is {currentUser.name}&apos;s roster. A Bob you add here is not Alice&apos;s
                  Bob until you merge them later.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {recent.map((n) => {
                    const on = names.includes(n);
                    const mine = n === currentUser.name;
                    return (
                      <button
                        key={n}
                        onClick={() => {
                          if (mine && on) return;
                          if (on) setNames((p) => p.filter((x) => x !== n));
                          else void addName(n);
                        }}
                        className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold"
                        style={{
                          background: on ? `${nameColor(n, recent)}28` : "rgba(28,25,23,0.04)",
                          border: `1px solid ${on ? nameColor(n, recent) + "55" : "rgba(28,25,23,0.08)"}`,
                          color: on ? nameColor(n, recent) : "var(--dim)",
                        }}
                      >
                        <Avatar name={n} names={recent} size={18} />
                        {mine ? "You" : n}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void addName()}
                    placeholder="Add someone new…"
                    className="field"
                  />
                  <button onClick={() => void addName()} className="shrink-0 rounded-xl bg-accent px-4 font-extrabold text-white">
                    Add
                  </button>
                </div>
              </div>
              {names.length > 0 && (
                <>
                  <Perf />
                  <div className="p-4">
                    <Label>Who paid?</Label>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {names.map((n) => (
                        <button
                          key={n}
                          onClick={() => {
                            setPaidBy(n);
                            const m = roster.find((x) => x.name === n);
                            if (m) setPayNow(m.paynow);
                          }}
                          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold"
                          style={{
                            background: paidBy === n ? `${nameColor(n, names)}28` : "rgba(28,25,23,0.04)",
                            border: `1px solid ${paidBy === n ? nameColor(n, names) + "55" : "rgba(28,25,23,0.08)"}`,
                            color: paidBy === n ? nameColor(n, names) : "var(--dim)",
                          }}
                        >
                          <Avatar name={n} names={names} size={18} />
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  {paidBy && (
                    <>
                      <Perf />
                      <div className="p-4">
                        <Label>PayNow ({paidBy})</Label>
                        <input
                          value={payNow}
                          onChange={(e) => setPayNow(e.target.value)}
                          placeholder="+65XXXXXXXX or UEN"
                          className="field mt-2"
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {names.length >= 2 && paidBy && (
              <>
                <button
                  onClick={() => setEqualConfirm(true)}
                  className="card w-full text-left"
                  style={{
                    border: "1px solid rgba(196,69,45,0.28)",
                    background: "rgba(196,69,45,0.08)",
                  }}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-accent/15 text-lg">
                      =
                    </div>
                    <div className="flex-1">
                      <div className="mb-0.5 text-[15px] font-extrabold">Split equally</div>
                      <div className="text-xs text-muted">Everyone pays the same amount</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[17px] font-extrabold text-accent">{perHead.toFixed(2)}</div>
                      <div className="text-[11px] text-muted">each</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setItems((p) =>
                      p.map((it) => ({
                        ...it,
                        split: true,
                        splitWith: [...names],
                        assignee: null,
                      })),
                    );
                    setStep("assign");
                  }}
                  className="card w-full text-left"
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-black/[0.04] text-dim">
                      <ListFilter size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="mb-0.5 text-[15px] font-extrabold">Assign by item</div>
                      <div className="text-xs text-muted">Starts equal — change anyone you need</div>
                    </div>
                  </div>
                </button>
              </>
            )}
            {names.length < 2 && (
              <div className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-[13px] text-danger">
                Add at least 2 people to continue
              </div>
            )}
          </div>
        </>
      )}

      {step === "assign" && (
        <>
          <SectionHeader title="Assign items" subtitle="Who had what?" onBack={() => setStep("people")} />
          <div className="flex flex-col gap-3.5 px-5">
            {receipts.map((receipt) => {
              const indexed = items
                .map((it, i) => ({ it, i }))
                .filter(({ it }) => it.receiptId === receipt.id);
              if (!indexed.length) return null;
              return (
                <div key={receipt.id} className="card">
                  {receipts.length > 1 && (
                    <div className="px-4 pb-1 pt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                      {receipt.label}
                    </div>
                  )}
                  {indexed.map(({ it, i }, row) => (
                    <div key={i}>
                      {(row > 0 || receipts.length > 1) && <Perf />}
                      <div className="p-4">
                        <div className="mb-2 flex justify-between">
                          <span className="pr-2 text-[13px] font-bold">
                            {it.split && <span className="mr-1 text-accent">⇌</span>}
                            {it.name}
                          </span>
                          <Amt value={it.price} color="var(--accent)" />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {names.map((n) => {
                            const selected = it.split ? it.splitWith.includes(n) : it.assignee === n;
                            return (
                              <button
                                key={n}
                                onClick={() =>
                                  setItems((p) =>
                                    p.map((x, idx) =>
                                      idx === i
                                        ? {
                                            ...x,
                                            assignee: x.assignee === n && !x.split ? null : n,
                                            split: false,
                                            splitWith: [],
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold"
                                style={{
                                  background: selected ? `${nameColor(n, names)}28` : "rgba(28,25,23,0.04)",
                                  border: `1px solid ${selected ? nameColor(n, names) + "55" : "rgba(28,25,23,0.08)"}`,
                                  color: selected ? nameColor(n, names) : "var(--dim)",
                                }}
                              >
                                {n}
                              </button>
                            );
                          })}
                          {names.length >= 2 && (
                            <button
                              onClick={() => setSplitPicker(i)}
                              className={`rounded-full px-2.5 py-1.5 text-xs font-bold ${
                                it.split
                                  ? "border border-accent/30 bg-accent/10 text-accent"
                                  : "border border-border bg-black/[0.04] text-dim"
                              }`}
                            >
                              ⇌ Split
                              {it.split && it.splitWith.length ? ` ÷${it.splitWith.length}` : ""}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {!allAssigned && (
              <div className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
                {items.filter((it) => !it.split && !it.assignee).length} items still unassigned
              </div>
            )}
            <button
              disabled={!allAssigned || !names.length || !paidBy}
              onClick={() => {
                if (isEqualSplit(items, names)) setEqualConfirm(true);
                else void persist(items);
              }}
              className="btn-primary"
            >
              Save bill
            </button>
          </div>
          {splitPicker !== null && items[splitPicker] && (
            <SplitPicker
              item={items[splitPicker]}
              names={names}
              onClose={() => setSplitPicker(null)}
              onConfirm={(selected) => {
                setItems((p) =>
                  p.map((x, idx) =>
                    idx === splitPicker
                      ? selected.length === 1
                        ? { ...x, split: false, splitWith: [], assignee: selected[0] }
                        : { ...x, split: true, splitWith: selected, assignee: null }
                      : x,
                  ),
                );
                setSplitPicker(null);
              }}
            />
          )}
        </>
      )}

      {adding && (
        <Sheet
          title="Add another receipt"
          subtitle="Append a slip to this bill"
          onClose={() => !scanning && setAdding(false)}
        >
          <input
            ref={addCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0], true)}
          />
          <input
            ref={addLibraryRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0], true)}
          />
          <button
            onClick={!scanning ? () => addCameraRef.current?.click() : undefined}
            className="mb-2.5 flex w-full flex-col items-center gap-2 rounded-[14px] border-2 border-dashed border-accent/30 bg-accent/[0.04] px-8 py-8"
          >
            <Camera size={28} className="text-accent" />
            <div className="text-sm font-bold text-accent">
              {scanning ? "Reading receipt…" : "Take photo"}
            </div>
          </button>
          <button
            onClick={() => addLibraryRef.current?.click()}
            disabled={scanning}
            className="btn-ghost mb-2.5 flex items-center justify-center gap-2"
          >
            <ImageIcon size={16} /> Photo library
          </button>
          <button
            disabled={scanning}
            onClick={() => {
              appendDraft(blankDraft());
              setAdding(false);
            }}
            className="btn-ghost flex items-center justify-center gap-2"
          >
            <Pencil size={16} /> Enter manually
          </button>
          {ocrError && (
            <div className="mt-3 rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-[13px] text-danger">
              {ocrError}
            </div>
          )}
        </Sheet>
      )}

      {equalConfirm && (
        <ConfirmSheet
          title="Split equally?"
          body={`${names.length} people · SGD ${perHead.toFixed(2)} each. You can still send each person their live link after.`}
          confirmLabel="Save equal split"
          onClose={() => setEqualConfirm(false)}
          onConfirm={() => {
            const equalItems = items.map((it) => ({
              ...it,
              split: true,
              splitWith: [...names],
              assignee: null,
            }));
            void persist(equalItems);
          }}
        />
      )}
    </div>
  );
}

function SplitPicker({
  item,
  names,
  onClose,
  onConfirm,
}: {
  item: BillItem;
  names: string[];
  onClose: () => void;
  onConfirm: (selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(item.splitWith?.length ? item.splitWith : [...names]);
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4">
      <div className="w-full max-w-[400px] rounded-[20px] border border-border bg-card p-6">
        <div className="mb-4 text-[15px] font-extrabold">Split &quot;{item.name}&quot;</div>
        <div className="mb-5 flex flex-col gap-2">
          {names.map((n) => (
            <button
              key={n}
              onClick={() => setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]))}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
              style={{
                background: selected.includes(n) ? "rgba(196,69,45,0.1)" : "rgba(28,25,23,0.03)",
                border: `1px solid ${selected.includes(n) ? "rgba(196,69,45,0.4)" : "rgba(28,25,23,0.08)"}`,
              }}
            >
              <Avatar name={n} names={names} />
              <span className="text-sm font-semibold">{n}</span>
              {selected.includes(n) && <span className="ml-auto text-accent">✓</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button
            disabled={!selected.length}
            onClick={() => onConfirm(selected)}
            className="btn-primary flex-[2] py-3 text-sm"
          >
            Split {selected.length} ways
          </button>
        </div>
      </div>
    </div>
  );
}

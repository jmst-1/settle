"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ImageIcon, ListFilter, Pencil } from "lucide-react";
import { Amt, Label, Perf, SectionHeader } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { nameColor } from "@/lib/colors";
import { DUMMY_OCR } from "@/lib/mock-data";
import { useMock } from "@/context/MockStore";
import { matchRosterName, rosterFor } from "@/lib/me";
import type { BillItem, OcrResult } from "@/lib/types";

function expandOcr(ocr: OcrResult): BillItem[] {
  return (ocr.items || []).flatMap((it) => {
    const qty = it.qty || 1;
    if (qty <= 1) {
      return [{ name: it.name, price: parseFloat(String(it.unitPrice)) || 0, assignee: null, split: false, splitWith: [] }];
    }
    return Array.from({ length: qty }, (_, k) => ({
      name: `${it.name} #${k + 1}`,
      price: parseFloat(String(it.unitPrice)) || 0,
      assignee: null,
      split: false,
      splitWith: [],
    }));
  });
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

type Step = "upload" | "review" | "people" | "assign";

export function NewBillWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { saveBill, currentUser, contacts, addContact, inbox } = useMock();
  const mode = params.get("mode") || "scan";
  const rxId = params.get("rx");
  const rx = inbox.find((r) => r.id === rxId);
  const preload = rx ? DUMMY_OCR[rx.ocrKey] : null;

  const [step, setStep] = useState<Step>(preload ? "review" : mode === "manual" ? "review" : "upload");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(!!preload);
  const [occasion, setOccasion] = useState(preload ? rx?.label || preload.occasion : "");
  const [billDate, setBillDate] = useState(preload?.bill_date || new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<BillItem[]>(
    preload ? expandOcr(preload) : [{ name: "", price: 0, assignee: null, split: false, splitWith: [] }],
  );
  const [discount, setDiscount] = useState(parseFloat(String(preload?.discount)) || 0);
  const [sc, setSc] = useState(parseFloat(String(preload?.serviceCharge)) || 0);
  const [tax, setTax] = useState(parseFloat(String(preload?.tax)) || 0);
  const [receiptTotal, setReceiptTotal] = useState(parseFloat(String(preload?.total)) || 0);
  const [names, setNames] = useState<string[]>([currentUser.name]);
  const [newName, setNewName] = useState("");
  const [paidBy, setPaidBy] = useState(currentUser.name);
  const [payNow, setPayNow] = useState(currentUser.paynow);
  const [equalConfirm, setEqualConfirm] = useState(false);
  const [splitPicker, setSplitPicker] = useState<number | null>(null);

  const roster = rosterFor(contacts, currentUser.id);
  const recent = roster.map((c) => c.name);
  const itemSubtotal = items.reduce((s, it) => s + it.price, 0);
  const derivedTotal = itemSubtotal - discount + sc + tax;
  const diff = receiptTotal > 0 ? Math.abs(receiptTotal - derivedTotal) : 0;
  const allAssigned = items.length > 0 && items.every((it) => (it.split && it.splitWith.length) || it.assignee);
  const perHead = names.length ? derivedTotal / names.length : 0;

  const applyOcr = (ocr: OcrResult) => {
    setOccasion(ocr.occasion || "");
    setBillDate(ocr.bill_date || new Date().toISOString().slice(0, 10));
    setItems(expandOcr(ocr));
    setDiscount(ocr.discount || 0);
    setSc(ocr.serviceCharge || 0);
    setTax(ocr.tax || 0);
    setReceiptTotal(ocr.total || 0);
    setScanned(true);
    setStep("review");
  };

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      applyOcr(DUMMY_OCR["bill-1"]);
      setScanning(false);
    }, 1400);
  };

  const persist = (billItems: BillItem[]) => {
    saveBill(
      {
        id: crypto.randomUUID(),
        occasion: occasion || "Untitled bill",
        billDate,
        currency: "SGD",
        items: billItems,
        names: [...names],
        discount,
        serviceCharge: sc,
        tax,
        receiptTotal: receiptTotal || derivedTotal,
        paidBy,
        payNowNumber: payNow,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
      },
      rxId || undefined,
    );
    router.push("/");
  };

  const addName = (n?: string) => {
    const raw = (n ?? newName).trim();
    if (!raw) return;
    const hit = matchRosterName(contacts, currentUser.id, raw);
    const name = hit?.name ?? addContact(raw).name;
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
          <SectionHeader title="New bill" subtitle="Scan or enter manually" onBack={() => router.push("/")} />
          <div className="flex flex-col gap-3.5 px-5">
            <button
              onClick={!scanning ? handleScan : undefined}
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
                <div className="text-[13px] text-muted">Mock OCR uses the Handlebar receipt</div>
              )}
            </button>
            <button onClick={handleScan} className="btn-ghost flex items-center justify-center gap-2">
              <ImageIcon size={16} /> Photo library
            </button>
            <button onClick={() => setStep("review")} className="btn-ghost flex items-center justify-center gap-2">
              <Pencil size={16} /> Enter manually
            </button>
          </div>
        </>
      )}

      {step === "review" && (
        <>
          <SectionHeader
            title="Review receipt"
            subtitle={scanned ? "OCR complete — edit anything that's off" : "Enter your items"}
            onBack={() => (preload ? router.push("/inbox") : setStep("upload"))}
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
            <div className="card">
              <div className="px-4 pb-1.5 pt-3.5">
                <Label>Items</Label>
              </div>
              {items.map((it, i) => (
                <div key={i}>
                  <Perf />
                  <div className="flex items-center gap-2 px-4 py-3">
                    <input
                      value={it.name}
                      onChange={(e) => setItems((p) => p.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                      placeholder="Item name"
                      className="min-w-0 flex-1 border-none bg-transparent text-sm font-semibold outline-none"
                    />
                    <input
                      value={it.price || ""}
                      onChange={(e) =>
                        setItems((p) => p.map((x, idx) => (idx === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x)))
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
                  onClick={() => setItems((p) => [...p, { name: "", price: 0, assignee: null, split: false, splitWith: [] }])}
                  className="text-[13px] font-bold text-accent"
                >
                  + Add item
                </button>
              </div>
            </div>
            <div className="card">
              {[
                ["Bill discount", discount, setDiscount, "var(--ok)", true],
                ["Service charge", sc, setSc, "var(--dim)", false],
                ["GST", tax, setTax, "var(--dim)", false],
              ].map(([lbl, val, setter, clr, neg]) => (
                <div key={String(lbl)}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <span className="flex-1 text-[13px]" style={{ color: String(clr) }}>
                      {String(lbl)}
                    </span>
                    {Boolean(neg) && <span style={{ color: String(clr) }}>−</span>}
                    <input
                      value={(val as number) || ""}
                      onChange={(e) => (setter as (n: number) => void)(parseFloat(e.target.value) || 0)}
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
                <span className="text-sm font-bold">Total</span>
                <Amt value={derivedTotal} color="var(--accent)" size={16} />
              </div>
              {diff > 0.01 && (
                <div className="px-4 pb-3.5">
                  <div className="rounded-[10px] border border-warn/20 bg-warn/10 px-3 py-2 text-xs text-warn">
                    Receipt total was {receiptTotal.toFixed(2)} — differs by {diff.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
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
            subtitle={`${items.length} items · SGD ${derivedTotal.toFixed(2)}`}
            onBack={() => setStep("review")}
          />
          <div className="flex flex-col gap-3.5 px-5">
            <div className="card">
              <div className="p-4">
                <Label>Your people</Label>
                <p className="mb-2 mt-1 text-[11px] leading-relaxed text-muted">
                  This is {currentUser.name}&apos;s roster. A Bob you add here is not Alice&apos;s
                  Bob until a super-user merge.
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
                          else addName(n);
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
                    onKeyDown={(e) => e.key === "Enter" && addName()}
                    placeholder="Add someone new…"
                    className="field"
                  />
                  <button onClick={() => addName()} className="shrink-0 rounded-xl bg-accent px-4 font-extrabold text-white">
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
            <div className="card">
              {items.map((it, i) => (
                <div key={i}>
                  {i > 0 && <Perf />}
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
                            {it.split && it.splitWith.length
                              ? ` ÷${it.splitWith.length}`
                              : ""}
                          </button>
                        )}
                      </div>
                  </div>
                </div>
              ))}
            </div>
            {!allAssigned && (
              <div className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
                {items.filter((it) => !it.split && !it.assignee).length} items still unassigned
              </div>
            )}
            <button
              disabled={!allAssigned || !names.length || !paidBy}
              onClick={() => {
                if (isEqualSplit(items, names)) setEqualConfirm(true);
                else persist(items);
              }}
              className="btn-primary"
            >
              Save bill
            </button>
          </div>
          {splitPicker !== null && (
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
            persist(equalItems);
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


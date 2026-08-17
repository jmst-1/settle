"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Image as ImageIcon } from "lucide-react";
import { Amt, Perf, SectionHeader } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import { nameColor } from "@/lib/colors";
import { personTotals } from "@/lib/debts";
import { MEMBERS } from "@/lib/mock-data";
import { fmtDate, fmtMoney, origin } from "@/lib/format";
import type { Bill } from "@/lib/types";

export function BillDetailScreen({ bill }: { bill: Bill }) {
  const router = useRouter();
  const [tab, setTab] = useState<"summary" | "items">("summary");
  const [share, setShare] = useState<string | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const totals = useMemo(() => personTotals(bill), [bill]);
  const collected = Object.values(totals).reduce((s, t) => s + t.total, 0);
  const locked = Boolean(bill.lockedAt);

  return (
    <div className="pb-10">
      <SectionHeader
        title={bill.occasion}
        subtitle={`${fmtDate(bill.billDate)} · Paid by ${bill.paidBy}${locked ? " · locked" : ""}`}
        onBack={() => router.push("/")}
        action={
          !locked ? (
            <button
              onClick={() => router.push(`/bills/${bill.id}/edit`)}
              className="mt-8 text-[13px] font-semibold text-dim"
            >
              Edit
            </button>
          ) : null
        }
      />
      <div className="flex flex-col gap-3.5 px-5">
        <div className="flex gap-1.5 rounded-xl bg-white/[0.04] p-1">
          {(["summary", "items"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-[9px] py-2 text-[13px] font-bold capitalize ${
                tab === t ? "bg-[#1F1D1A] text-text" : "bg-transparent text-muted"
              }`}
            >
              {t === "summary" ? "Per person" : "Full bill"}
            </button>
          ))}
        </div>

        {tab === "summary" &&
          bill.names.map((n) => {
            const t = totals[n];
            const color = nameColor(n, bill.names);
            const isPayer = n === bill.paidBy;
            const token = MEMBERS.find((m) => m.name === n)?.shareToken ?? n.toLowerCase();
            return (
              <div key={n} className="card">
                <div
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ background: `linear-gradient(90deg,${color}12,transparent)` }}
                >
                  <Avatar name={n} names={bill.names} size={36} />
                  <div className="flex-1">
                    <div className="text-[15px] font-extrabold">
                      {n}{" "}
                      {isPayer && (
                        <span className="ml-1 text-[11px] font-bold" style={{ color }}>
                          PAID
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {t.items.length} item{t.items.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[17px] font-extrabold" style={{ color }}>
                      {fmtMoney(t.total, bill.currency)}
                    </div>
                    {!isPayer && (
                      <div className="mt-0.5 text-[11px] text-muted">owes {bill.paidBy}</div>
                    )}
                  </div>
                </div>
                <div className="px-4 py-2">
                  {t.items.map((it, j) => (
                    <div key={j} className="mb-1">
                      <div
                        className="flex justify-between text-[13px]"
                        style={{ color: it.isShared ? "#4ECDC4" : "#C8C4BE" }}
                      >
                        <span>
                          {it.isShared && "⇌ "}
                          {it.name}
                        </span>
                        <span className="font-mono text-xs">{fmtMoney(it.amount, bill.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {(bill.discount > 0 || bill.serviceCharge > 0 || bill.tax > 0) && (
                  <>
                    <Perf />
                    <div className="px-4 py-2 text-xs">
                      {bill.discount > 0 && (
                        <Row label="Discount" value={`− ${fmtMoney(t.discount)}`} color="#96CEB4" />
                      )}
                      {bill.serviceCharge > 0 && (
                        <Row label="Service charge" value={fmtMoney(t.sc)} />
                      )}
                      {bill.tax > 0 && <Row label="GST" value={fmtMoney(t.tax)} />}
                    </div>
                  </>
                )}
                <Perf />
                <div className="flex gap-2 p-4">
                  <button
                    onClick={() => setShare(n)}
                    className="flex-1 rounded-xl py-2.5 text-[13px] font-bold"
                    style={{
                      border: `1px solid ${color}66`,
                      background: `${color}18`,
                      color,
                    }}
                  >
                    <Link2 size={13} className="mr-1 inline" /> Send link
                  </button>
                  <button
                    onClick={() => setCard(n)}
                    className="flex-1 rounded-xl border border-white/10 py-2.5 text-[13px] font-bold text-dim"
                  >
                    <ImageIcon size={13} className="mr-1 inline" /> Card
                  </button>
                </div>
                {share === n && (
                  <ShareLinkModal
                    name={n}
                    amount={t.total}
                    token={token}
                    occasion={bill.occasion}
                    onClose={() => setShare(null)}
                  />
                )}
                {card === n && (
                  <Sheet title={`Card for ${n}`} subtitle="Static snapshot — the link stays live" onClose={() => setCard(null)}>
                    <div
                      className="mb-4 overflow-hidden rounded-xl border border-white/10"
                      style={{ borderTop: `4px solid ${color}` }}
                    >
                      <div className="px-4 py-3" style={{ background: `${color}18` }}>
                        <div className="text-lg font-extrabold">{n}</div>
                        <div className="text-xs text-muted">
                          {bill.occasion} · {bill.billDate}
                        </div>
                      </div>
                      <div className="space-y-1 px-4 py-3">
                        {t.items.slice(0, 6).map((it, i) => (
                          <div key={i} className="flex justify-between text-xs text-dim">
                            <span>
                              {it.isShared ? "⇌ " : ""}
                              {it.name}
                            </span>
                            <span className="font-mono">{it.amount.toFixed(2)}</span>
                          </div>
                        ))}
                        {t.items.length > 6 && (
                          <div className="text-[11px] text-muted">+{t.items.length - 6} more</div>
                        )}
                      </div>
                      <div className="flex justify-between bg-accent/10 px-4 py-3 text-sm font-bold">
                        <span>Total</span>
                        <span className="font-mono" style={{ color }}>
                          {fmtMoney(t.total)}
                        </span>
                      </div>
                    </div>
                    <p className="text-center text-[12px] text-muted">
                      PNG export lands in the production build. Use Send link for the live page.
                    </p>
                  </Sheet>
                )}
              </div>
            );
          })}

        {tab === "summary" && (
          <div className="flex items-center justify-between rounded-[14px] border border-accent/20 bg-accent/10 px-[18px] py-3.5">
            <span className="text-[13px] font-semibold text-muted">Total collected</span>
            <span className="font-mono text-[17px] font-extrabold text-accent">
              {fmtMoney(collected, bill.currency)}
            </span>
          </div>
        )}

        {tab === "items" && (
          <div className="card">
            {bill.items.map((it, i) => (
              <div key={i}>
                {i > 0 && <Perf />}
                <div className="flex justify-between gap-2 px-4 py-3.5">
                  <div>
                    <div className="text-[13px] font-semibold">
                      {it.split && <span className="mr-1 text-accent">⇌</span>}
                      {it.name}
                    </div>
                    {it.split && (
                      <div className="text-[11px] text-muted">Split: {it.splitWith.join(", ")}</div>
                    )}
                    {it.assignee && <div className="text-[11px] text-dim">{it.assignee}</div>}
                  </div>
                  <Amt value={it.price} />
                </div>
              </div>
            ))}
            <Perf />
            <div className="p-4">
              {bill.discount > 0 && <Row label="Discount" value={`− ${bill.discount.toFixed(2)}`} color="#96CEB4" />}
              {bill.serviceCharge > 0 && <Row label="Service charge" value={bill.serviceCharge.toFixed(2)} />}
              {bill.tax > 0 && <Row label="GST" value={bill.tax.toFixed(2)} />}
              <div className="mt-1 flex justify-between text-[15px] font-extrabold">
                <span>Total</span>
                <Amt value={bill.receiptTotal} color="#4ECDC4" size={16} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="mb-1 flex justify-between" style={{ color: color || "#5A5652" }}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function ShareLinkModal({
  name,
  amount,
  token,
  occasion,
  onClose,
}: {
  name: string;
  amount: number;
  token: string;
  occasion: string;
  onClose: () => void;
}) {
  const url = `${origin()}/settle/${token}`;
  const text = `${name}, your ${occasion} split is SGD ${amount.toFixed(2)} — ${url}`;
  const [copied, setCopied] = useState(false);
  return (
    <Sheet title={`Send ${name}'s link`} subtitle="Same link forever. New bills appear automatically." onClose={onClose}>
      <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-dim">
        {text}
      </div>
      <button
        className="btn-primary"
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ text, url });
            else {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            }
          } catch {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }
        }}
      >
        {copied ? "Copied" : "Share / copy message"}
      </button>
    </Sheet>
  );
}

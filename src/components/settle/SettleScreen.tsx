"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, QrCode, RotateCcw, Share2 } from "lucide-react";
import { Amt, Label, Perf, SectionHeader } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmSheet, Sheet } from "@/components/ui/Sheet";
import { PayNowQR } from "@/components/ui/PayNowQR";
import { useMock } from "@/context/MockStore";
import { simplifyDebts } from "@/lib/debts";
import { paynowFor } from "@/lib/mock-data";
import { nameColor } from "@/lib/colors";
import { origin } from "@/lib/format";

export function SettleScreen() {
  const { bills, settlePair, undoPair } = useMock();
  const router = useRouter();
  const allUnsettled = bills.flatMap((b) =>
    b.debts.filter((d) => !d.settled).map((d) => ({ ...d, occasion: b.occasion })),
  );
  const simplified = simplifyDebts(allUnsettled);
  const [qr, setQr] = useState<{ name: string; pn: string; amount: number } | null>(null);
  const [confirm, setConfirm] = useState<{ from: string; to: string; amount: number } | null>(
    null,
  );
  const [share, setShare] = useState<{ from: string; to: string; amount: number } | null>(null);

  const recentlySettled = useMemo(() => {
    const pairs = new Set<string>();
    bills.forEach((b) =>
      b.debts
        .filter((d) => d.settled)
        .forEach((d) => pairs.add([d.from, d.to].sort().join("||"))),
    );
    return Array.from(pairs).map((k) => {
      const [a, b] = k.split("||");
      return { a, b };
    });
  }, [bills]);

  return (
    <div className="pb-28">
      <SectionHeader
        title="Settle up"
        subtitle={
          simplified.length
            ? `${simplified.length} payment${simplified.length !== 1 ? "s" : ""} to clear`
            : "No outstanding balances"
        }
        onBack={() => router.push("/")}
      />

      {simplified.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <div className="mb-2 text-xl font-extrabold">All clear</div>
          <div className="text-sm text-muted">No outstanding balances</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5">
          <Label>Simplified payments</Label>
          <p className="mb-1 text-xs leading-relaxed text-muted">
            You see the net. Friends&apos; links still show per-bill amounts — that&apos;s
            intentional.
          </p>
          {simplified.map((txn) => {
            const pn = paynowFor(txn.to);
            const color = nameColor(txn.from, [txn.from, txn.to]);
            return (
              <div key={`${txn.from}-${txn.to}`} className="card">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar name={txn.from} names={[txn.from, txn.to]} size={34} />
                  <span className="text-xl text-[#3A3632]">→</span>
                  <Avatar name={txn.to} names={[txn.from, txn.to]} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold">
                      {txn.from} <span className="font-normal text-muted">pays</span> {txn.to}
                    </div>
                    {pn && <div className="mt-0.5 text-[11px] text-muted">{pn}</div>}
                  </div>
                  <Amt value={txn.amount} color="#4ECDC4" size={18} />
                </div>
                <Perf />
                <div className="flex gap-2 p-4">
                  <button
                    onClick={() => setShare(txn)}
                    className="flex-1 rounded-xl py-2.5 text-xs font-bold"
                    style={{
                      border: `1px solid ${color}44`,
                      background: `${color}0D`,
                      color,
                    }}
                  >
                    <Share2 size={12} className="mr-1 inline" /> Send link
                  </button>
                  {pn && (
                    <button
                      onClick={() => setQr({ name: txn.to, pn, amount: txn.amount })}
                      className="flex-1 rounded-xl border border-accent/30 bg-accent/10 py-2.5 text-xs font-bold text-accent"
                    >
                      <QrCode size={12} className="mr-1 inline" /> PayNow
                    </button>
                  )}
                  <button
                    onClick={() => setConfirm(txn)}
                    className="flex-1 rounded-xl bg-ok/10 py-2.5 text-xs font-bold text-ok"
                  >
                    <Check size={12} className="mr-1 inline" /> Paid
                  </button>
                </div>
              </div>
            );
          })}

          <div className="mt-2">
            <Label>By bill</Label>
            <div className="mt-2.5 flex flex-col gap-2.5">
              {bills
                .filter((b) => b.debts.some((d) => !d.settled))
                .map((b) => (
                  <div key={b.id} className="card px-4 py-3.5">
                    <div className="mb-2 text-[13px] font-bold">
                      {b.occasion}{" "}
                      <span className="text-[11px] font-normal text-muted">{b.billDate}</span>
                    </div>
                    {b.debts
                      .filter((d) => !d.settled)
                      .map((d) => (
                        <div
                          key={`${d.from}-${d.to}`}
                          className="mb-1 flex justify-between text-[13px] text-dim last:mb-0"
                        >
                          <span>
                            {d.from} → {d.to}
                          </span>
                          <Amt value={d.amount} />
                        </div>
                      ))}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {recentlySettled.length > 0 && (
        <div className="mt-6 px-5">
          <Label>Recently marked paid</Label>
          <div className="mt-2 flex flex-col gap-2">
            {recentlySettled.map((p) => (
              <button
                key={`${p.a}-${p.b}`}
                onClick={() => undoPair(p.a, p.b)}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left text-[13px] text-dim"
              >
                <span>
                  Undo {p.a} ↔ {p.b}
                </span>
                <RotateCcw size={14} />
              </button>
            ))}
          </div>
        </div>
      )}

      {qr && (
        <Sheet title={`Pay ${qr.name}`} subtitle={`SGD ${qr.amount.toFixed(2)}`} onClose={() => setQr(null)}>
          <div className="flex flex-col items-center">
            <PayNowQR proxy={qr.pn} amount={qr.amount} size={220} />
            <div className="mt-3 text-xs text-muted">{qr.pn}</div>
            <p className="mt-3 text-center text-[12px] text-muted">
              Scan with your banking app. SplitTab does not take the money.
            </p>
          </div>
        </Sheet>
      )}

      {share && (
        <Sheet
          title={`Send ${share.from}'s link`}
          subtitle="Link-first. Their page shows raw per-bill amounts."
          onClose={() => setShare(null)}
        >
          <ShareLinkPreview from={share.from} amount={share.amount} />
        </Sheet>
      )}

      {confirm && (
        <ConfirmSheet
          title={`Mark ${confirm.from} → ${confirm.to} paid?`}
          body={`This settles both directions of this pair across bills (SGD ${confirm.amount.toFixed(2)} net). You can undo after.`}
          confirmLabel="Mark paid"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            settlePair(confirm.from, confirm.to);
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}

function ShareLinkPreview({ from, amount }: { from: string; amount: number }) {
  const token = from.toLowerCase();
  const url = `${origin()}/settle/${token}`;
  const text = `${from}, your SplitTab balance is SGD ${amount.toFixed(2)} — ${url}`;
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-dim">
        {text}
      </div>
      <button
        className="btn-primary"
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ text });
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
        {copied ? "Copied" : "Share / copy"}
      </button>
    </div>
  );
}

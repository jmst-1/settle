"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronDown, ChevronUp } from "lucide-react";
import { Amt, Perf } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui/Avatar";
import { PayNowQR } from "@/components/ui/PayNowQR";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { useMock } from "@/context/MockStore";
import { personTotals } from "@/lib/debts";
import { memberByToken, paynowFor } from "@/lib/mock-data";
import { nameColor } from "@/lib/colors";
import { fmtDate, fmtMoney } from "@/lib/format";

export function PortalScreen({ token }: { token: string }) {
  const { bills, portalPay } = useMock();
  const member = memberByToken(token);
  const [openBill, setOpenBill] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [hint, setHint] = useState(true);

  const name = member?.name;

  const creditors = useMemo(() => {
    if (!name) return [];
    const map = new Map<
      string,
      {
        amount: number;
        paynow: string;
        bills: {
          id: string;
          occasion: string;
          date: string;
          amount: number;
          items: { name: string; amount: number; isShared: boolean }[];
          discount: number;
          sc: number;
          tax: number;
        }[];
      }
    >();

    for (const bill of bills) {
      const debts = bill.debts.filter((d) => d.from === name && !d.settled);
      if (!debts.length) continue;
      const totals = personTotals(bill);
      const mine = totals[name];
      for (const d of debts) {
        const cur = map.get(d.to) ?? { amount: 0, paynow: paynowFor(d.to), bills: [] };
        cur.amount += d.amount;
        cur.bills.push({
          id: bill.id,
          occasion: bill.occasion,
          date: bill.billDate,
          amount: d.amount,
          items: mine?.items ?? [],
          discount: mine?.discount ?? 0,
          sc: mine?.sc ?? 0,
          tax: mine?.tax ?? 0,
        });
        map.set(d.to, cur);
      }
    }
    return Array.from(map.entries()).map(([creditor, data]) => ({ creditor, ...data }));
  }, [bills, name]);

  const total = creditors.reduce((s, c) => s + c.amount, 0);
  const owner = "Alice";

  if (!name) {
    return (
      <div className="px-6 py-20 text-center">
        <div className="text-lg font-extrabold">Link not found</div>
        <p className="mt-2 text-sm text-muted">This settle link isn&apos;t valid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-12">
      <div className="px-5 pb-2 pt-8">
        <div className="mb-6 text-[11px] font-bold uppercase tracking-[4px] text-accent">SplitTab</div>
        <div className="text-[15px] text-dim">Hi, {name}</div>
        <div className="mt-1 text-[13px] text-muted">You owe</div>
        <div className="mt-1 font-mono text-[40px] font-extrabold tracking-tight leading-none">
          {total.toFixed(2)}
          <span className="ml-1.5 text-sm font-normal text-muted">SGD</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="mx-5 mt-8 rounded-2xl border border-ok/20 bg-ok/10 px-5 py-10 text-center">
          <div className="text-xl font-extrabold text-ok">You&apos;re all clear</div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            New bills from {owner} will appear here — bookmark this page.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4 px-5">
          <p className="text-[12px] leading-relaxed text-muted">
            SplitTab does not take the money. Pay each person directly via PayNow, then tap I&apos;ve
            paid.
          </p>
          {creditors.map((c) => {
            const color = nameColor(c.creditor, [name, c.creditor]);
            return (
              <div key={c.creditor} className="card">
                <div
                  className="flex items-center gap-3 px-4 py-4"
                  style={{ background: `linear-gradient(90deg,${color}14,transparent)` }}
                >
                  <Avatar name={c.creditor} names={[name, c.creditor]} size={40} />
                  <div className="flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Pay
                    </div>
                    <div className="text-[17px] font-extrabold">{c.creditor}</div>
                  </div>
                  <Amt value={c.amount} color={color} size={22} />
                </div>
                <div className="flex flex-col items-center px-4 py-5">
                  {c.paynow ? (
                    <>
                      <PayNowQR proxy={c.paynow} amount={c.amount} size={220} />
                      <div className="mt-3 font-mono text-xs text-dim">{c.paynow}</div>
                      <div className="mt-1 text-[11px] text-muted">
                        Scan with your banking app
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted">No PayNow on file for {c.creditor}</div>
                  )}
                </div>
                <Perf />
                <div className="px-2 py-2">
                  {c.bills.map((b) => {
                    const open = openBill === `${c.creditor}-${b.id}`;
                    return (
                      <div key={b.id}>
                        <button
                          onClick={() =>
                            setOpenBill(open ? null : `${c.creditor}-${b.id}`)
                          }
                          className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                        >
                          <span>
                            <span className="text-[13px] font-bold">{b.occasion}</span>
                            <span className="ml-2 text-[11px] text-muted">{fmtDate(b.date)}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-xs text-dim">{fmtMoney(b.amount)}</span>
                            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </span>
                        </button>
                        {open && (
                          <div className="px-3 pb-3">
                            {b.items.map((it, i) => (
                              <div
                                key={i}
                                className="mb-1 flex justify-between text-[12px]"
                                style={{ color: it.isShared ? "#4ECDC4" : "#C8C4BE" }}
                              >
                                <span>
                                  {it.isShared ? "⇌ " : ""}
                                  {it.name}
                                </span>
                                <span className="font-mono">{it.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="p-4 pt-1">
                  <button
                    onClick={() => setConfirm(c.creditor)}
                    className="btn-primary"
                  >
                    I&apos;ve paid {c.creditor}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hint && (
        <div className="mx-5 mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <Bookmark size={16} className="mt-0.5 shrink-0 text-accent" />
          <div className="flex-1 text-[12px] leading-relaxed text-dim">
            Add this page to your Home Screen. New bills from {owner} will show up here
            automatically.
          </div>
          <button onClick={() => setHint(false)} className="text-[11px] font-bold text-muted">
            OK
          </button>
        </div>
      )}

      <div className="mt-8 px-5 text-center">
        <Link href="/login" className="text-[12px] font-semibold text-muted">
          Save this in SplitTab →
        </Link>
      </div>

      {confirm && (
        <ConfirmSheet
          title={`Tell ${owner} you paid ${confirm}?`}
          body={`This notifies ${owner} that you paid ${confirm} ${fmtMoney(
            creditors.find((c) => c.creditor === confirm)?.amount ?? 0,
          )}. SplitTab does not move the money.`}
          confirmLabel={`I've paid ${confirm}`}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            portalPay(name, confirm);
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}

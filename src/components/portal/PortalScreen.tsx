"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronDown, ChevronUp } from "lucide-react";
import { Amt, Perf } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui/Avatar";
import { PayNowQR } from "@/components/ui/PayNowQR";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { useMock } from "@/context/MockStore";
import { personTotals, foldDebtsForPairs } from "@/lib/debts";
import {
  creatorName,
  expandPairNames,
  pairContaining,
  pairsForCreator,
  partnerName,
  paynowForContact,
  userByToken,
} from "@/lib/me";
import { nameColor } from "@/lib/colors";
import { fmtDate, fmtMoney } from "@/lib/format";

export function PortalScreen({ token }: { token: string }) {
  const { bills, users, contacts, pairs, portalPay, setCurrentUser } = useMock();
  const router = useRouter();
  const member = userByToken(users, token);
  const [openBill, setOpenBill] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [hint, setHint] = useState(true);

  const name = member?.name;

  const creditors = useMemo(() => {
    if (!name) return [];
    const map = new Map<
      string,
      {
        key: string;
        creatorId: string;
        creditor: string;
        amount: number;
        paynow: string;
        settler: string | null;
        partner: string | null;
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
      const myNames = expandPairNames(pairs, bill.createdBy, name);
      const debts = bill.debts.filter((d) => myNames.includes(d.from) && !d.settled);
      if (!debts.length) continue;
      const creatorPairs = pairsForCreator(pairs, bill.createdBy);
      const folded = foldDebtsForPairs(debts, creatorPairs);
      const totals = personTotals(bill);
      const mergedItems = myNames.flatMap((n) =>
        (totals[n]?.items ?? []).map((it) => ({
          name: it.name,
          amount: it.amount,
          isShared: it.isShared,
        })),
      );
      const mergedDiscount = myNames.reduce((s, n) => s + (totals[n]?.discount ?? 0), 0);
      const mergedSc = myNames.reduce((s, n) => s + (totals[n]?.sc ?? 0), 0);
      const mergedTax = myNames.reduce((s, n) => s + (totals[n]?.tax ?? 0), 0);
      const pair = pairContaining(pairs, bill.createdBy, name);

      for (const d of folded) {
        const key = `${bill.createdBy}::${d.to}`;
        const cur = map.get(key) ?? {
          key,
          creatorId: bill.createdBy,
          creditor: d.to,
          amount: 0,
          paynow: paynowForContact(contacts, users, d.to, bill.createdBy),
          settler: pair && pair.memberNames.includes(name) ? pair.settler : null,
          partner: pair && pair.memberNames.includes(name) ? partnerName(pair, pair.settler) : null,
          bills: [],
        };
        cur.amount += d.amount;
        cur.bills.push({
          id: bill.id,
          occasion: bill.occasion,
          date: bill.billDate,
          amount: d.amount,
          items: mergedItems,
          discount: mergedDiscount,
          sc: mergedSc,
          tax: mergedTax,
        });
        map.set(key, cur);
      }
    }
    return Array.from(map.values());
  }, [bills, name, contacts, users, pairs]);

  const total = creditors.reduce((s, c) => s + c.amount, 0);

  if (!name || !member) {
    return (
      <div className="px-6 py-20 text-center">
        <div className="text-lg font-extrabold">Link not found</div>
        <p className="mt-2 text-sm text-muted">This settle link isn&apos;t valid.</p>
      </div>
    );
  }

  const pending = confirm ? creditors.find((c) => c.key === confirm) : null;

  return (
    <div className="min-h-dvh pb-12">
      <div className="px-5 pb-2 pt-8">
        <div className="mb-6 text-[11px] font-bold uppercase tracking-[4px] text-accent">SplitTab</div>
        <div className="text-[15px] text-dim">Hi, {name}</div>
        <div className="mt-1 text-[13px] text-muted">
          {creditors.some((c) => c.settler && c.settler !== name)
            ? `${Array.from(new Set(creditors.filter((c) => c.settler && c.settler !== name).map((c) => c.settler))).join(", ")} settles for you · combined`
            : "You owe"}
        </div>
        <div className="mt-1 font-mono text-[40px] font-extrabold tracking-tight leading-none">
          {total.toFixed(2)}
          <span className="ml-1.5 text-sm font-normal text-muted">SGD</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="mx-5 mt-8 rounded-2xl border border-ok/20 bg-ok/10 px-5 py-10 text-center">
          <div className="text-xl font-extrabold text-ok">You&apos;re all clear</div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            New bills you&apos;re on will appear here — bookmark this page.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4 px-5">
          <p className="text-[12px] leading-relaxed text-muted">
            SplitTab does not take the money. Pay each person on that creator&apos;s tab via
            PayNow, then tap I&apos;ve paid.
          </p>
          {creditors.map((c) => {
            const color = nameColor(c.creditor, [name, c.creditor]);
            const tab = creatorName(users, c.creatorId);
            return (
              <div key={c.key} className="card">
                <div
                  className="flex items-center gap-3 px-4 py-4"
                  style={{ background: `linear-gradient(90deg,${color}14,transparent)` }}
                >
                  <Avatar name={c.creditor} names={[name, c.creditor]} size={40} />
                  <div className="flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Pay · {tab}&apos;s tab
                      {c.settler && c.partner
                        ? ` · ${c.settler} (for ${c.partner})`
                        : ""}
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
                    const open = openBill === `${c.key}-${b.id}`;
                    return (
                      <div key={b.id}>
                        <button
                          onClick={() =>
                            setOpenBill(open ? null : `${c.key}-${b.id}`)
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
                                style={{ color: it.isShared ? "var(--accent)" : "var(--dim)" }}
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
                    onClick={() => setConfirm(c.key)}
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
        <div className="mx-5 mt-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <Bookmark size={16} className="mt-0.5 shrink-0 text-accent" />
          <div className="flex-1 text-[12px] leading-relaxed text-dim">
            Add this page to your Home Screen. New bills you&apos;re on will show up here.
          </div>
          <button onClick={() => setHint(false)} className="text-[11px] font-bold text-muted">
            OK
          </button>
        </div>
      )}

      <div className="mt-8 px-5 text-center">
        <button
          className="text-[13px] font-semibold text-accent"
          onClick={() => {
            setCurrentUser(member.id);
            router.push("/");
          }}
        >
          Open my bills
        </button>
        <div className="mt-2">
          <Link href="/login" className="text-[12px] font-semibold text-muted">
            Save this in SplitTab
          </Link>
        </div>
      </div>

      {pending && (
        <ConfirmSheet
          title={`Tell ${pending.creditor} you paid?`}
          body={`This marks ${
            pending.settler && pending.partner
              ? `${pending.settler} & ${pending.partner}`
              : "you"
          } paid ${pending.creditor} ${fmtMoney(
            pending.amount,
          )} on ${creatorName(users, pending.creatorId)}'s tab. SplitTab does not move the money.`}
          confirmLabel={`I've paid ${pending.creditor}`}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            portalPay(
              name,
              pending.creditor,
              pending.bills.map((b) => b.id),
            );
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}

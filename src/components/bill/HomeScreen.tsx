"use client";

import Link from "next/link";
import { Settings, Users } from "lucide-react";
import { Amt } from "@/components/ui/Typography";
import { AvatarStack } from "@/components/ui/Avatar";
import { useApp } from "@/context/AppStore";
import { foldDebtsForPairs } from "@/lib/debts";
import { fmtDate } from "@/lib/format";
import {
  coveredByNote,
  creatorName,
  involvingMe,
  myOutstanding,
  pairsForCreator,
  tabsByCreator,
  visibleBills,
} from "@/lib/me";

export function HomeScreen() {
  const { bills, users, pairs, currentUser } = useApp();
  const mine = visibleBills(bills, currentUser);
  const { owe, owed } = myOutstanding(mine, currentUser.name, pairs);
  const coverNote = coveredByNote(pairs, currentUser.name);
  const hasSettle = tabsByCreator(mine, pairs).some(
    (tab) => involvingMe(tab.simplified, currentUser.name, pairs, tab.creatorId).length > 0,
  );

  return (
    <div className="pb-28">
      <div className="flex items-start justify-between px-5 pb-4 pt-7">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[4px] text-accent">
            SplitTab
          </div>
          <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Bills</h1>
          <div className="mt-1 text-[13px] text-dim">Hi, {currentUser.name}</div>
        </div>
        <div className="flex gap-1 pt-1">
          <Link href="/groups" className="rounded-xl p-2 text-dim" aria-label="Groups">
            <Users size={18} />
          </Link>
          <Link href="/settings" className="rounded-xl p-2 text-dim" aria-label="Settings">
            <Settings size={18} />
          </Link>
        </div>
      </div>

      {mine.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-2xl text-accent">
            +
          </div>
          <div className="mb-2 text-[17px] font-bold">Split your first receipt</div>
          <p className="mx-auto max-w-[260px] text-[13px] leading-relaxed text-muted">
            Scan a bill, pick your people, they PayNow and tap I&apos;ve paid.
          </p>
        </div>
      ) : (
        <>
          <div className="mx-5 mb-5 rounded-[18px] border border-border bg-card-2 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-danger">
                  You owe
                </div>
                <div className="font-mono text-[26px] font-extrabold tracking-tight">
                  {owe.toFixed(2)}
                  <span className="ml-1 text-[12px] font-normal text-muted">SGD</span>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ok">
                  You&apos;re owed
                </div>
                <div className="font-mono text-[26px] font-extrabold tracking-tight">
                  {owed.toFixed(2)}
                  <span className="ml-1 text-[12px] font-normal text-muted">SGD</span>
                </div>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-muted">
              {coverNote ? `${coverNote} on combined tabs. ` : ""}
              Bills you’re on. Nets stay inside each creator’s tab.
            </div>
            {hasSettle && (
              <Link
                href="/settle"
                className="mt-4 block w-full rounded-xl bg-accent/15 py-2.5 text-center text-sm font-extrabold text-accent"
              >
                Settle up
              </Link>
            )}
          </div>

          <div className="flex flex-col gap-2.5 px-5">
            {mine.map((b) => {
              const folded = foldDebtsForPairs(
                b.debts.filter((d) => !d.settled),
                pairsForCreator(pairs, b.createdBy),
              );
              const owedAmt = folded.reduce((s, d) => s + d.amount, 0);
              const allSettled = owedAmt === 0 && b.debts.length > 0;
              const myDebt = folded
                .filter((d) => d.from === currentUser.name || d.to === currentUser.name)
                .reduce((s, d) => s + (d.from === currentUser.name ? d.amount : -d.amount), 0);
              return (
                <Link
                  key={b.id}
                  href={`/bills/${b.id}`}
                  className="card flex items-center gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 truncate text-sm font-bold">{b.occasion}</div>
                    <div className="flex items-center gap-2">
                      <AvatarStack names={b.names} />
                      <span className="font-mono text-[11px] text-muted">{fmtDate(b.billDate)}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {creatorName(users, b.createdBy)}&apos;s tab · paid by {b.paidBy}
                      {b.receipts && b.receipts.length > 1 ? ` · ${b.receipts.length} receipts` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Amt value={b.receiptTotal} size={15} />
                    <div className="mt-1">
                      {allSettled ? (
                        <span className="text-[11px] font-bold text-ok">Settled</span>
                      ) : myDebt > 0.005 ? (
                        <span className="font-mono text-[11px] font-bold text-danger">
                          you {myDebt.toFixed(2)}
                        </span>
                      ) : myDebt < -0.005 ? (
                        <span className="font-mono text-[11px] font-bold text-ok">
                          +{(-myDebt).toFixed(2)}
                        </span>
                      ) : owedAmt > 0 ? (
                        <span className="font-mono text-[11px] font-bold text-dim">
                          {owedAmt.toFixed(2)} due
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

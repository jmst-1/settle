"use client";

import Link from "next/link";
import { Settings, Users } from "lucide-react";
import { Amt } from "@/components/ui/Typography";
import { AvatarStack } from "@/components/ui/Avatar";
import { useMock } from "@/context/MockStore";
import { fmtDate } from "@/lib/format";

export function HomeScreen() {
  const { bills } = useMock();
  const outstanding = bills
    .flatMap((b) => b.debts.filter((d) => !d.settled))
    .reduce((s, d) => s + d.amount, 0);

  return (
    <div className="pb-28">
      <div className="flex items-start justify-between px-5 pb-4 pt-7">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[4px] text-accent">
            SplitTab
          </div>
          <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Bills</h1>
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

      {bills.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-2xl text-accent">
            +
          </div>
          <div className="mb-2 text-[17px] font-bold">Split your first receipt</div>
          <p className="mx-auto max-w-[260px] text-[13px] leading-relaxed text-muted">
            Scan a bill, send each person their link, they PayNow and tap I&apos;ve paid.
          </p>
        </div>
      ) : (
        <>
          <div className="mx-5 mb-5 rounded-[18px] border border-accent/20 bg-gradient-to-br from-accent/10 to-[#45B7D1]/10 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                  Outstanding
                </div>
                <div className="font-mono text-[30px] font-extrabold tracking-tight">
                  {outstanding.toFixed(2)}
                  <span className="ml-1 text-[13px] font-normal text-muted">SGD</span>
                </div>
                <div className="mt-1 text-[11px] text-muted">Money still in flight across bills</div>
              </div>
              <div className="text-right">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Bills
                </div>
                <div className="text-[30px] font-extrabold text-accent">{bills.length}</div>
              </div>
            </div>
            {outstanding > 0 && (
              <Link
                href="/settle"
                className="mt-4 block w-full rounded-xl bg-accent/15 py-2.5 text-center text-sm font-extrabold text-accent"
              >
                Settle up →
              </Link>
            )}
          </div>

          <div className="flex flex-col gap-2.5 px-5">
            {bills.map((b) => {
              const owed = b.debts.filter((d) => !d.settled).reduce((s, d) => s + d.amount, 0);
              const allSettled = owed === 0 && b.debts.length > 0;
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
                  </div>
                  <div className="shrink-0 text-right">
                    <Amt value={b.receiptTotal} size={15} />
                    <div className="mt-1">
                      {allSettled ? (
                        <span className="text-[11px] font-bold text-ok">Settled</span>
                      ) : owed > 0 ? (
                        <span className="font-mono text-[11px] font-bold text-danger">
                          {owed.toFixed(2)} due
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

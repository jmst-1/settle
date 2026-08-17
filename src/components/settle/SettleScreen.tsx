"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, QrCode, RotateCcw, Share2 } from "lucide-react";
import { Amt, Label, Perf, SectionHeader } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmSheet, Sheet } from "@/components/ui/Sheet";
import { PayNowQR } from "@/components/ui/PayNowQR";
import { useMock } from "@/context/MockStore";
import { fmtMoney, origin } from "@/lib/format";
import { nameColor } from "@/lib/colors";
import {
  canTagSettlement,
  creatorName,
  involvingMe,
  paynowForContact,
  tabsByCreator,
  userByName,
  visibleBills,
} from "@/lib/me";

export function SettleScreen() {
  const { bills, users, contacts, currentUser, settlePair, undoPair, markNotificationRead } = useMock();
  const router = useRouter();
  useEffect(() => {
    markNotificationRead();
  }, [markNotificationRead]);
  const mine = visibleBills(bills, currentUser);
  const tabs = tabsByCreator(mine).filter((tab) => {
    if (currentUser.superUser) return tab.simplified.length > 0 || tab.rawUnsettled.length > 0;
    return involvingMe(tab.simplified, currentUser.name).length > 0;
  });

  const [qr, setQr] = useState<{ name: string; pn: string; amount: number } | null>(null);
  const [confirm, setConfirm] = useState<{
    from: string;
    to: string;
    amount: number;
    creatorId: string;
  } | null>(null);
  const [share, setShare] = useState<{ from: string; amount: number } | null>(null);

  const recentlySettled = useMemo(() => {
    if (!currentUser.superUser) return [];
    const rows: { a: string; b: string; creatorId: string }[] = [];
    const seen = new Set<string>();
    mine.forEach((bill) => {
      bill.debts
        .filter((d) => d.settled)
        .forEach((d) => {
          const key = `${bill.createdBy}||${[d.from, d.to].sort().join("||")}`;
          if (seen.has(key)) return;
          seen.add(key);
          rows.push({ a: d.from, b: d.to, creatorId: bill.createdBy });
        });
    });
    return rows;
  }, [mine, currentUser.superUser]);

  return (
    <div className="pb-28">
      <SectionHeader
        title="Settle up"
        subtitle={
          currentUser.superUser
            ? "Each creator’s tab is netted separately"
            : "Your balances, per creator — tabs don’t mix"
        }
        onBack={() => router.push("/")}
      />

      {tabs.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <div className="mb-2 text-xl font-extrabold">All clear</div>
          <div className="text-sm text-muted">No outstanding balances for you</div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-5">
          <p className="text-xs leading-relaxed text-muted">
            Bob on Alice&apos;s tab is not Bob on Dana&apos;s tab until a merge. Pay the person
            who paid that restaurant.
          </p>
          {tabs.map((tab) => {
            const owner = creatorName(users, tab.creatorId);
            const txns = currentUser.superUser
              ? tab.simplified
              : involvingMe(tab.simplified, currentUser.name);
            if (!txns.length) return null;
            return (
              <div key={tab.creatorId}>
                <Label>
                  {owner}&apos;s tab
                  {tab.creatorId === currentUser.id ? " · yours" : ""}
                </Label>
                <div className="mt-2.5 flex flex-col gap-3">
                  {txns.map((txn) => {
                    const pn = paynowForContact(contacts, users, txn.to, tab.creatorId);
                    const color = nameColor(txn.from, [txn.from, txn.to]);
                    const canTag = canTagSettlement(
                      currentUser,
                      tab.creatorId,
                      txn.from,
                      txn.to,
                    );
                    const iPay = txn.from === currentUser.name;
                    const theyPayMe = txn.to === currentUser.name;
                    return (
                      <div key={`${tab.creatorId}-${txn.from}-${txn.to}`} className="card">
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          <Avatar name={txn.from} names={[txn.from, txn.to]} size={34} />
                          <span className="text-xl text-[#3A3632]">→</span>
                          <Avatar name={txn.to} names={[txn.from, txn.to]} size={34} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-bold">
                              {txn.from === currentUser.name ? "You" : txn.from}{" "}
                              <span className="font-normal text-muted">pays</span>{" "}
                              {txn.to === currentUser.name ? "you" : txn.to}
                            </div>
                            {pn && <div className="mt-0.5 text-[11px] text-muted">{pn}</div>}
                          </div>
                          <Amt value={txn.amount} color="#4ECDC4" size={18} />
                        </div>
                        <Perf />
                        <div className="flex gap-2 p-4">
                          {(theyPayMe || currentUser.id === tab.creatorId || currentUser.superUser) && (
                            <button
                              onClick={() => setShare({ from: txn.from, amount: txn.amount })}
                              className="flex-1 rounded-xl py-2.5 text-xs font-bold"
                              style={{
                                border: `1px solid ${color}44`,
                                background: `${color}0D`,
                                color,
                              }}
                            >
                              <Share2 size={12} className="mr-1 inline" /> Send link
                            </button>
                          )}
                          {iPay && pn && (
                            <button
                              onClick={() => setQr({ name: txn.to, pn, amount: txn.amount })}
                              className="flex-1 rounded-xl border border-accent/30 bg-accent/10 py-2.5 text-xs font-bold text-accent"
                            >
                              <QrCode size={12} className="mr-1 inline" /> PayNow
                            </button>
                          )}
                          {canTag && (
                            <button
                              onClick={() =>
                                setConfirm({ ...txn, creatorId: tab.creatorId })
                              }
                              className="flex-1 rounded-xl bg-ok/10 py-2.5 text-xs font-bold text-ok"
                            >
                              <Check size={12} className="mr-1 inline" />{" "}
                              {iPay ? "I've paid" : "Paid"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recentlySettled.length > 0 && (
        <div className="mt-6 px-5">
          <Label>Undo (super only)</Label>
          <div className="mt-2 flex flex-col gap-2">
            {recentlySettled.map((p) => (
              <button
                key={`${p.creatorId}-${p.a}-${p.b}`}
                onClick={() => undoPair(p.a, p.b, p.creatorId)}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left text-[13px] text-dim"
              >
                <span>
                  Undo {p.a} ↔ {p.b} · {creatorName(users, p.creatorId)}&apos;s tab
                </span>
                <RotateCcw size={14} />
              </button>
            ))}
          </div>
        </div>
      )}

      {qr && (
        <Sheet title={`Pay ${qr.name}`} subtitle={fmtMoney(qr.amount)} onClose={() => setQr(null)}>
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
          subtitle="Unguessable token. Their me-centric app + pay page."
          onClose={() => setShare(null)}
        >
          <ShareLinkPreview from={share.from} amount={share.amount} />
        </Sheet>
      )}

      {confirm && (
        <ConfirmSheet
          title={`Mark ${confirm.from} → ${confirm.to} paid?`}
          body={`Only this creator’s tab (${creatorName(users, confirm.creatorId)}). SGD ${confirm.amount.toFixed(2)} net. Creator or the people on the debt can tag it.`}
          confirmLabel="Mark paid"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            settlePair(confirm.from, confirm.to, confirm.creatorId);
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}

function ShareLinkPreview({ from, amount }: { from: string; amount: number }) {
  const { users } = useMock();
  const member = userByName(users, from);
  const token = member?.shareToken;
  const url = token ? `${origin()}/settle/${token}` : "";
  const text = token
    ? `${from}, your SplitTab balance is SGD ${amount.toFixed(2)} — ${url}`
    : `${from} doesn’t have an app link in this mock (new names aren’t users yet).`;
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-dim">
        {text}
      </div>
      {token && (
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
      )}
    </div>
  );
}

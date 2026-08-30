"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/ui/Typography";
import { useApp } from "@/context/AppStore";
import { fmtDate, fmtMoney, origin } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  dismissed: "Dismissed",
  converted: "Split",
  matched: "Linked",
};

export default function SettingsPage() {
  const {
    currentUser,
    setProfile,
    logout,
    alertSettings,
    gmail,
    emailBackConfigured,
    transactions,
    updateAlertSettings,
    simulateAlert,
    syncGmail,
    disconnectGmail,
    actOnTransaction,
  } = useApp();
  const [name, setName] = useState(currentUser.name);
  const [paynow, setPaynow] = useState(currentUser.paynow);
  const [threshold, setThreshold] = useState(String(alertSettings.amountThreshold));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useSearchParams();
  const gmailFlash = params.get("gmail");

  useEffect(() => {
    setName(currentUser.name);
    setPaynow(currentUser.paynow);
  }, [currentUser]);

  useEffect(() => {
    setThreshold(String(alertSettings.amountThreshold));
  }, [alertSettings.amountThreshold]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="pb-28">
      <SectionHeader title="Settings" onBack={() => router.push("/")} />
      <div className="flex flex-col gap-3.5 px-5">
        <div className="text-[13px] text-dim">Signed in as {currentUser.name}</div>
        <div className="card p-4">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Display name
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field mt-2" />
        </div>
        <div className="card p-4">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Default PayNow
          </label>
          <input value={paynow} onChange={(e) => setPaynow(e.target.value)} className="field mt-2" />
          <p className="mt-2 text-[12px] text-muted">Prefills when you mark yourself as the payer.</p>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Your link</div>
          <p className="mt-2 break-all font-mono text-[12px] text-dim">
            {origin()}/settle/{currentUser.shareToken}
          </p>
          <p className="mt-2 text-[12px] text-muted">
            Unguessable token. Not your name. This is how friends open your pay page.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={async () => {
            await setProfile(name, paynow);
            router.push("/");
          }}
        >
          Save
        </button>

        <div className="card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Bank alerts</div>
          <p className="mt-2 text-[13px] text-dim">
            Connect Gmail so SplitTab can watch bank and card emails for dining charges worth splitting.
          </p>
          {gmailFlash === "connected" && (
            <p className="mt-2 text-[13px] text-ok">Gmail connected.</p>
          )}
          {gmailFlash === "error" && (
            <p className="mt-2 text-[13px] text-danger">
              Could not connect Gmail{params.get("reason") ? ` — ${params.get("reason")}` : "."}
            </p>
          )}
          {gmail.connected ? (
            <div className="mt-3">
              <div className="text-sm font-bold">{gmail.email}</div>
              <div className="mt-0.5 text-[12px] text-muted">
                Last sync {gmail.lastSyncAt ? fmtDate(gmail.lastSyncAt) : "not yet"}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  className="btn-ghost py-2.5 text-sm"
                  disabled={Boolean(busy)}
                  onClick={() => void run("sync", () => syncGmail())}
                >
                  {busy === "sync" ? "Syncing…" : "Sync now"}
                </button>
                <button
                  className="btn-ghost py-2.5 text-sm"
                  disabled={Boolean(busy)}
                  onClick={() => void run("disconnect", () => disconnectGmail())}
                >
                  Disconnect Gmail
                </button>
              </div>
            </div>
          ) : gmail.configured ? (
            <a href="/api/gmail/connect" className="btn-primary mt-3 block py-2.5 text-center text-sm">
              Connect Gmail
            </a>
          ) : (
            <p className="mt-3 text-[12px] text-muted">
              Gmail OAuth is not configured on this server. Use Simulate below to try the flow.
            </p>
          )}

          <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-muted">
            Amount threshold (SGD)
          </label>
          <input
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            inputMode="decimal"
            className="field mt-2"
          />
          <p className="mt-2 text-[12px] text-muted">
            Dining charges at or above this amount get an Inbox prompt. Default 30.
          </p>
          <button
            className="btn-ghost mt-2 py-2 text-sm"
            onClick={() =>
              void run("threshold", () =>
                updateAlertSettings({ amountThreshold: Number(threshold) || 30 }),
              )
            }
          >
            Save threshold
          </button>

          <label className="mt-4 flex items-center justify-between gap-3 text-[13px]">
            <span>Dining merchants only</span>
            <input
              type="checkbox"
              checked={alertSettings.diningOnly}
              onChange={(e) => void updateAlertSettings({ diningOnly: e.target.checked })}
            />
          </label>
          <label className="mt-3 flex items-center justify-between gap-3 text-[13px]">
            <span>Email me split prompts</span>
            <input
              type="checkbox"
              checked={alertSettings.emailBack}
              disabled={!emailBackConfigured}
              onChange={(e) => void updateAlertSettings({ emailBack: e.target.checked })}
            />
          </label>
          {!emailBackConfigured && (
            <p className="mt-2 text-[12px] text-muted">
              Email-back needs RESEND_API_KEY. In-app Inbox prompts still work.
            </p>
          )}
          <label className="mt-3 flex items-center justify-between gap-3 text-[13px]">
            <span>Watch bank emails</span>
            <input
              type="checkbox"
              checked={alertSettings.enabled}
              onChange={(e) => void updateAlertSettings({ enabled: e.target.checked })}
            />
          </label>

          <div className="mt-4 flex flex-col gap-2">
            <button
              className="btn-ghost py-2.5 text-sm"
              disabled={Boolean(busy)}
              onClick={() => void run("sim", () => simulateAlert())}
            >
              {busy === "sim" ? "Simulating…" : "Simulate bank alert"}
            </button>
            <button
              className="btn-ghost py-2.5 text-sm"
              disabled={Boolean(busy)}
              onClick={() => void run("match", () => simulateAlert({ matchHandlebar: true }))}
            >
              Simulate existing Handlebar bill
            </button>
          </div>
          {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
        </div>

        <div className="card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Detected transactions
          </div>
          {transactions.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted">None yet. Connect Gmail or simulate an alert.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {transactions.slice(0, 20).map((t) => (
                <div key={t.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold">{t.merchant}</div>
                      <div className="font-mono text-[11px] text-muted">
                        {fmtMoney(t.amount, t.currency)} · {fmtDate(t.txnDate)}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                  {t.status === "dismissed" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn-ghost flex-1 py-2 text-xs"
                        onClick={() => void actOnTransaction(t.id, "undo")}
                      >
                        Undo
                      </button>
                      <button
                        className="btn-ghost flex-1 py-2 text-xs"
                        onClick={() => void actOnTransaction(t.id, "never")}
                      >
                        Always skip
                      </button>
                    </div>
                  )}
                  {t.status === "pending" && (
                    <button
                      className="btn-ghost mt-2 py-2 text-xs"
                      onClick={() => router.push("/inbox")}
                    >
                      Open in Inbox
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn-ghost" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </div>
  );
}

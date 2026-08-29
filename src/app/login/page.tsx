"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<"email" | "demo" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const claimFromNext = (() => {
    try {
      return new URL(next, "http://local").searchParams.get("claim") || "";
    } catch {
      return "";
    }
  })();
  const claim = params.get("claim") || claimFromNext;

  return (
    <div className="px-6 pt-16">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[4px] text-accent">SplitTab</div>
      <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Sign in</h1>
      <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-muted">
        Magic link for you. Friends use their own unguessable link — they get a me-centric app,
        no account required.
      </p>

      {sent ? (
        <div className="mt-10 rounded-2xl border border-accent/20 bg-accent/10 p-5">
          <div className="font-extrabold">
            {mode === "demo" ? "You’re in" : "Check your email"}
          </div>
          <p className="mt-1 text-sm text-dim">
            {mode === "demo"
              ? "Email isn’t configured on this server, so this demo signed you in directly."
              : "Open the magic link we sent. It signs you in on this device."}
          </p>
          {mode === "demo" && (
            <button onClick={() => router.replace(next)} className="btn-primary mt-5">
              Open my bills
            </button>
          )}
        </div>
      ) : (
        <form
          className="mt-10 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const res = await fetch("/api/auth/magic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, claim: claim || undefined }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Could not send link");
              setMode(data.mode === "demo" ? "demo" : "email");
              setSent(true);
              if (data.mode === "demo") {
                const dest = data.user && !data.user.onboardedAt ? "/welcome" : next;
                router.replace(dest);
              }
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="field"
          />
          {error && <div className="text-[13px] text-danger">{error}</div>}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

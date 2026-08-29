"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppStore";

function WelcomeForm() {
  const { currentUser, setProfile } = useApp();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const claim = params.get("claim");

  return (
    <div className="px-6 pt-16">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[4px] text-accent">SplitTab</div>
      <h1 className="m-0 text-[28px] font-extrabold tracking-tight">What should friends call you?</h1>
      <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-muted">
        This name shows on bills and pay links. You can change it later in Settings.
      </p>
      {currentUser.email && (
        <p className="mt-3 text-[13px] text-dim">Signed in as {currentUser.email}</p>
      )}

      <form
        className="mt-10 flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) {
            setError("Enter a name friends will recognize.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            await setProfile(trimmed, currentUser.paynow);
            router.replace(claim ? `/?claim=${encodeURIComponent(claim)}` : "/");
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          type="text"
          autoFocus
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="field"
        />
        {error && <div className="text-[13px] text-danger">{error}</div>}
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary">
          {busy ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomeForm />
    </Suspense>
  );
}

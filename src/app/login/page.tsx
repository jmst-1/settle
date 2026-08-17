"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const router = useRouter();

  return (
    <div className="px-6 pt-16">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[4px] text-accent">SplitTab</div>
      <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Sign in</h1>
      <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-muted">
        Magic link for the person chasing the bill. Friends never need an account.
      </p>

      {sent ? (
        <div className="mt-10 rounded-2xl border border-accent/20 bg-accent/10 p-5">
          <div className="font-extrabold">Check your email</div>
          <p className="mt-1 text-sm text-dim">
            Mockup: no email is sent. Continue into the owner app.
          </p>
          <button onClick={() => router.push("/")} className="btn-primary mt-5">
            Continue as Alice
          </button>
        </div>
      ) : (
        <form
          className="mt-10 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
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
          <button type="submit" className="btn-primary">
            Send magic link
          </button>
        </form>
      )}
    </div>
  );
}

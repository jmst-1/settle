"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/ui/Typography";
import { useMock } from "@/context/MockStore";

export default function SettingsPage() {
  const { currentUser, setProfile } = useMock();
  const [name, setName] = useState(currentUser.name);
  const [paynow, setPaynow] = useState(currentUser.paynow);
  const router = useRouter();

  useEffect(() => {
    setName(currentUser.name);
    setPaynow(currentUser.paynow);
  }, [currentUser]);

  return (
    <div className="pb-28">
      <SectionHeader title="Settings" onBack={() => router.push("/")} />
      <div className="flex flex-col gap-3.5 px-5">
        <div className="text-[13px] text-dim">
          Signed in as {currentUser.name}
          {currentUser.superUser ? " · super user" : ""}
        </div>
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
            /settle/{currentUser.shareToken}
          </p>
          <p className="mt-2 text-[12px] text-muted">
            Unguessable token. Not your name. This is how friends open your pay page and your bills.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setProfile(name, paynow);
            router.push("/");
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

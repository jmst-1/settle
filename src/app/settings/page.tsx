"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/ui/Typography";
import { useMock } from "@/context/MockStore";

export default function SettingsPage() {
  const { ownerName, defaultPaynow, setProfile } = useMock();
  const [name, setName] = useState(ownerName);
  const [paynow, setPaynow] = useState(defaultPaynow);
  const router = useRouter();

  return (
    <div className="pb-28">
      <SectionHeader title="Settings" onBack={() => router.push("/")} />
      <div className="flex flex-col gap-3.5 px-5">
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

"use client";

import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui/Avatar";
import { MEMBERS } from "@/lib/mock-data";

export default function GroupsPage() {
  const router = useRouter();
  return (
    <div className="pb-28">
      <SectionHeader
        title="Groups"
        subtitle="Not a tab — optional named crews"
        onBack={() => router.push("/")}
      />
      <div className="px-5">
        <div className="card p-4">
          <div className="text-[15px] font-extrabold">Personal</div>
          <div className="mt-1 text-xs text-muted">Default group for one-off bills</div>
          <div className="mt-3 flex gap-2">
            {MEMBERS.map((m) => (
              <Avatar key={m.name} name={m.name} names={MEMBERS.map((x) => x.name)} />
            ))}
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          Named groups (e.g. House, Climbing) ship in Phase 8. Recent people already appear when
          you start a bill.
        </p>
      </div>
    </div>
  );
}

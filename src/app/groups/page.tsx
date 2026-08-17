"use client";

import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui/Avatar";
import { useMock } from "@/context/MockStore";
import { rosterFor } from "@/lib/me";

export default function GroupsPage() {
  const router = useRouter();
  const { currentUser, contacts } = useMock();
  const roster = rosterFor(contacts, currentUser.id);
  return (
    <div className="pb-28">
      <SectionHeader
        title="Your people"
        subtitle={`${currentUser.name}'s roster — not a shared directory`}
        onBack={() => router.push("/")}
      />
      <div className="px-5">
        <div className="card p-4">
          <div className="text-[15px] font-extrabold">{currentUser.name}&apos;s tab</div>
          <div className="mt-1 text-xs text-muted">
            People you can put on a bill you create. Same first name on someone else&apos;s bill is
            a different person until the super user merges.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {roster.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1.5">
                <Avatar name={m.name} names={roster.map((x) => x.name)} size={22} />
                <span className="text-[13px] font-bold">
                  {m.name === currentUser.name ? "You" : m.name}
                </span>
              </div>
            ))}
          </div>
        </div>
        {currentUser.superUser && (
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            You&apos;re the super user. Merge of duplicate people is not in this mock — prevention
            is chips + name match on add.
          </p>
        )}
      </div>
    </div>
  );
}
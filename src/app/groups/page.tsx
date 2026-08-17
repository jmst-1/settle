"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/context/AppStore";
import { rosterFor } from "@/lib/me";

export default function GroupsPage() {
  const router = useRouter();
  const { currentUser, contacts, groups, createGroup, addGroupMember } = useApp();
  const mine = groups.filter((g) => g.ownerId === currentUser.id);
  const [newGroup, setNewGroup] = useState("");
  const [memberName, setMemberName] = useState<Record<string, string>>({});

  return (
    <div className="pb-28">
      <SectionHeader
        title="Groups"
        subtitle="Your people, per tab — not a shared directory"
        onBack={() => router.push("/")}
      />
      <div className="flex flex-col gap-3.5 px-5">
        {mine.map((g) => {
          const roster = rosterFor(contacts, currentUser.id, g.id);
          return (
            <div key={g.id} className="card p-4">
              <div className="text-[15px] font-extrabold">
                {g.name}
                {g.isPersonal ? " · Personal" : ""}
              </div>
              <div className="mt-1 text-xs text-muted">
                {g.isPersonal
                  ? "People you can put on a bill you create. Same first name on someone else’s tab is a different person until you merge them later."
                  : "Named group on your tab only."}
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
              <div className="mt-3 flex gap-2">
                <input
                  value={memberName[g.id] || ""}
                  onChange={(e) => setMemberName((p) => ({ ...p, [g.id]: e.target.value }))}
                  placeholder="Add someone…"
                  className="field"
                />
                <button
                  onClick={async () => {
                    const n = (memberName[g.id] || "").trim();
                    if (!n) return;
                    await addGroupMember(g.id, n);
                    setMemberName((p) => ({ ...p, [g.id]: "" }));
                  }}
                  className="shrink-0 rounded-xl bg-accent px-4 font-extrabold text-white"
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}
        <div className="card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">New named group</div>
          <div className="mt-3 flex gap-2">
            <input
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="e.g. House trip"
              className="field"
            />
            <button
              onClick={async () => {
                const n = newGroup.trim();
                if (!n) return;
                await createGroup(n);
                setNewGroup("");
              }}
              className="shrink-0 rounded-xl bg-accent px-4 font-extrabold text-white"
            >
              Create
            </button>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Merge of the same person across creator tabs is later.
          </p>
        </div>
      </div>
    </div>
  );
}

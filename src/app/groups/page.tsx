"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/ui/Typography";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { ConfirmSheet, Sheet } from "@/components/ui/Sheet";
import { useApp } from "@/context/AppStore";
import { pairsForCreator, rosterFor } from "@/lib/me";

export default function GroupsPage() {
  const router = useRouter();
  const {
    currentUser,
    contacts,
    groups,
    pairs,
    createGroup,
    addGroupMember,
    combinePayees,
    uncombinePayees,
  } = useApp();
  const mine = groups.filter((g) => g.ownerId === currentUser.id);
  const [newGroup, setNewGroup] = useState("");
  const [memberName, setMemberName] = useState<Record<string, string>>({});

  const allRoster = rosterFor(contacts, currentUser.id);
  const rosterNames = allRoster.map((x) => x.name);
  const myPairs = pairsForCreator(pairs, currentUser.id);
  const pairedNames = new Set(myPairs.flatMap((p) => p.memberNames));
  const unpaired = allRoster.filter((m) => !pairedNames.has(m.name));

  const [picked, setPicked] = useState<string[]>([]);
  const [settlerPick, setSettlerPick] = useState<[string, string] | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const togglePick = (name: string) => {
    setPicked((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= 2) return [prev[1], name];
      return [...prev, name];
    });
  };

  const dropPair = myPairs.find((p) => p.id === dropId);

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

        {myPairs.length > 0 && (
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
              Combined · one settles
            </div>
            <div className="flex flex-col gap-2.5">
              {myPairs.map((pair) => {
                const partner = pair.memberNames.find((n) => n !== pair.settler) ?? pair.memberNames[1];
                return (
                  <div key={pair.id} className="card px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <AvatarStack names={[...pair.memberNames]} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-extrabold">
                          {pair.memberNames[0]} + {pair.memberNames[1]}
                        </div>
                        <div className="mt-0.5 text-[12px] text-muted">
                          {pair.settler === currentUser.name ? "You" : pair.settler} settles
                          {partner ? ` for ${partner === currentUser.name ? "you" : partner}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => setDropId(pair.id)}
                        className="shrink-0 text-[12px] font-bold text-dim"
                      >
                        Uncombine
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {unpaired.length >= 2 && (
          <div className="card p-4">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
              Combine two people
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-muted">
              Tag items to each person on a receipt. One of them settles for both — useful for a
              couple. Either person can still be on a bill alone.
            </p>
            <div className="flex flex-wrap gap-2">
              {unpaired.map((m) => {
                const on = picked.includes(m.name);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => togglePick(m.name)}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-bold"
                    style={{
                      background: on ? "rgba(180, 83, 9, 0.12)" : "rgba(28,25,23,0.04)",
                      border: on ? "1px solid rgba(180, 83, 9, 0.4)" : "1px solid transparent",
                      color: on ? "var(--accent)" : "var(--text)",
                    }}
                  >
                    <Avatar name={m.name} names={rosterNames} size={22} />
                    {m.name === currentUser.name ? "You" : m.name}
                  </button>
                );
              })}
            </div>
            {picked.length === 2 && (
              <button
                className="btn-primary mt-4"
                onClick={() => setSettlerPick([picked[0], picked[1]])}
              >
                Combine {picked[0] === currentUser.name ? "You" : picked[0]} +{" "}
                {picked[1] === currentUser.name ? "you" : picked[1]}
              </button>
            )}
          </div>
        )}
      </div>

      {settlerPick && (
        <Sheet
          title="Who settles?"
          subtitle={`${settlerPick[0]} and ${settlerPick[1]} stay separate on receipts. One PayNow, one I've paid.`}
          onClose={() => setSettlerPick(null)}
        >
          <div className="flex flex-col gap-2">
            {settlerPick.map((n) => (
              <button
                key={n}
                className="flex items-center gap-3 rounded-xl border border-border bg-card-2 px-3 py-3 text-left"
                onClick={async () => {
                  await combinePayees(settlerPick[0], settlerPick[1], n);
                  setSettlerPick(null);
                  setPicked([]);
                }}
              >
                <Avatar name={n} names={settlerPick} size={32} />
                <div>
                  <div className="text-[14px] font-extrabold">
                    {n === currentUser.name ? "You" : n} pays
                  </div>
                  <div className="text-[12px] text-muted">
                    For {settlerPick.find((x) => x !== n)} too
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {dropPair && (
        <ConfirmSheet
          title={`Uncombine ${dropPair.memberNames[0]} + ${dropPair.memberNames[1]}?`}
          body="They'll settle separately again. Already-paid debts stay paid."
          confirmLabel="Uncombine"
          onClose={() => setDropId(null)}
          onConfirm={async () => {
            await uncombinePayees(dropPair.id);
            setDropId(null);
          }}
        />
      )}
    </div>
  );
}

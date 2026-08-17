"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ImageIcon } from "lucide-react";
import { Label, Perf } from "@/components/ui/Typography";
import { Sheet } from "@/components/ui/Sheet";
import { useMock } from "@/context/MockStore";
import { fmtDateTime } from "@/lib/format";

export function InboxScreen() {
  const { inbox, captureInbox } = useMock();
  const params = useSearchParams();
  const router = useRouter();
  const unprocessed = inbox.filter((r) => !r.processed);
  const [capture, setCapture] = useState(false);

  useEffect(() => {
    if (params.get("capture") === "1") setCapture(true);
  }, [params]);

  return (
    <div className="pb-28">
      <div className="px-5 pb-4 pt-7">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[4px] text-accent">
          SplitTab
        </div>
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Inbox</h1>
        {unprocessed.length > 0 && (
          <div className="mt-1 text-[13px] text-muted">
            {unprocessed.length} receipt{unprocessed.length !== 1 ? "s" : ""} waiting to split
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-5">
        {unprocessed.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mb-3 text-[17px] font-bold">Inbox empty</div>
            <p className="text-[13px] text-muted">Capture a receipt to process later</p>
          </div>
        ) : (
          unprocessed.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center gap-3.5 px-4 py-3.5">
                <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-accent">
                  <ImageIcon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{r.label}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">
                    {fmtDateTime(r.capturedAt)}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-warn">
                  Pending
                </span>
              </div>
              <Perf />
              <div className="p-4">
                <button
                  onClick={() => router.push(`/bills/new?mode=inbox&rx=${r.id}`)}
                  className="btn-primary py-2.5 text-sm"
                >
                  Process → Split
                </button>
              </div>
            </div>
          ))
        )}
        <button onClick={() => setCapture(true)} className="btn-ghost mt-1">
          Capture new receipt
        </button>
      </div>

      {capture && (
        <CaptureModal
          onClose={() => {
            setCapture(false);
            router.replace("/inbox");
          }}
          onSave={(label) => {
            captureInbox(label);
            setCapture(false);
            router.replace("/inbox");
          }}
        />
      )}
    </div>
  );
}

function CaptureModal({
  onSave,
  onClose,
}: {
  onSave: (label: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [snapped, setSnapped] = useState(false);
  const [busy, setBusy] = useState(false);

  const snap = () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setSnapped(true);
    }, 800);
  };

  return (
    <Sheet title="Capture receipt" subtitle="Save now, split later" onClose={onClose}>
      <button
        onClick={!snapped && !busy ? snap : undefined}
        className={`mb-4 flex w-full flex-col items-center gap-2 rounded-[14px] border-2 border-dashed px-8 py-8 ${
          snapped ? "border-ok/40 bg-ok/5" : "border-white/10 bg-white/[0.02]"
        }`}
      >
        <Camera size={28} className={snapped ? "text-ok" : "text-dim"} />
        <div className={`text-sm font-bold ${snapped ? "text-ok" : "text-dim"}`}>
          {snapped ? "Receipt captured" : busy ? "Snapping…" : "Take photo"}
        </div>
        <div className="text-xs text-[#3A3632]">Camera or photo library</div>
      </button>
      <Label>
        Label <span className="font-normal normal-case tracking-normal text-[#3A3632]">(optional)</span>
      </Label>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Dinner at Lavo"
        className="field mt-2 mb-5"
      />
      <div className="flex gap-2.5">
        <button onClick={onClose} className="btn-ghost flex-1">
          Cancel
        </button>
        <button onClick={() => onSave(label)} disabled={!snapped} className="btn-primary flex-[2] py-3 text-sm">
          Save to inbox
        </button>
      </div>
    </Sheet>
  );
}

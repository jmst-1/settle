"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ImageIcon } from "lucide-react";
import { Label, Perf } from "@/components/ui/Typography";
import { Sheet } from "@/components/ui/Sheet";
import { useApp } from "@/context/AppStore";
import { fmtDateTime } from "@/lib/format";

export function InboxScreen() {
  const { inbox, captureInbox, currentUser } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const unprocessed = inbox.filter((r) => !r.processed && r.ownerId === currentUser.id);
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
        <div className="mt-1 text-[13px] text-dim">{currentUser.name}&apos;s captures</div>
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
                <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] border border-border bg-card-2 text-accent">
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
                  Process
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
          onSave={async (label, imagePath) => {
            await captureInbox(label, imagePath);
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
  onSave: (label: string, imagePath?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPath(data.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Capture receipt" subtitle="Save now, split later" onClose={onClose}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <button
        onClick={!path && !busy ? () => cameraRef.current?.click() : undefined}
        className={`mb-3 flex w-full flex-col items-center gap-2 rounded-[14px] border-2 border-dashed px-8 py-8 ${
          path ? "border-ok/40 bg-ok/5" : "border-border bg-card-2"
        }`}
      >
        <Camera size={28} className={path ? "text-ok" : "text-dim"} />
        <div className={`text-sm font-bold ${path ? "text-ok" : "text-dim"}`}>
          {path ? "Receipt captured" : busy ? "Uploading…" : "Take photo"}
        </div>
        <div className="text-xs text-muted">Camera or photo library</div>
      </button>
      <button onClick={() => libraryRef.current?.click()} className="btn-ghost mb-4 py-2.5 text-sm">
        <ImageIcon size={14} className="mr-1 inline" /> Photo library
      </button>
      {error && <div className="mb-3 text-[13px] text-danger">{error}</div>}
      <Label>
        Label <span className="font-normal normal-case tracking-normal text-muted">(optional)</span>
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
        <button
          onClick={() => void onSave(label, path || undefined)}
          disabled={!path}
          className="btn-primary flex-[2] py-3 text-sm"
        >
          Save to inbox
        </button>
      </div>
    </Sheet>
  );
}

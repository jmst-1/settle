import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { appOrigin } from "@/lib/config";
import { ingestParsedAlert } from "@/lib/alerts/ingest";
import { clientState } from "@/lib/data/repo";
import { looksLikeDining } from "@/lib/alerts/dining";
import type { ParsedTransaction } from "@/lib/types";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    merchant?: string;
    amount?: number;
    date?: string;
    isDining?: boolean;
    matchHandlebar?: boolean;
  };
  const parsed: ParsedTransaction = body.matchHandlebar
    ? {
        merchant: "Handlebar Gillman",
        amount: 376.37,
        currency: "SGD",
        date: "2026-05-20",
        isDining: true,
        confidence: 0.9,
      }
    : {
        merchant: body.merchant?.trim() || "Burnt Ends",
        amount: Number(body.amount) || 48.2,
        currency: "SGD",
        date: body.date || new Date().toISOString().slice(0, 10),
        isDining: body.isDining ?? looksLikeDining(body.merchant || "Burnt Ends"),
        confidence: 0.85,
      };
  const result = await ingestParsedAlert(user.id, {
    parsed,
    gmailMessageId: `sim-${crypto.randomUUID()}`,
    sourceFrom: "simulate@splittab.local",
    inboxUrl: `${appOrigin(req)}/inbox`,
  });
  const state = await clientState(user.id);
  return NextResponse.json({ ...state, skipped: result.skipped, status: result.transaction?.status });
}

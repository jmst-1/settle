import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  clientState,
  dismissTransaction,
  matchTransaction,
  neverSplitTransaction,
  undoTransaction,
} from "@/lib/data/repo";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { action?: string; billId?: string };
  try {
    if (body.action === "dismiss") await dismissTransaction(user.id, params.id);
    else if (body.action === "undo") await undoTransaction(user.id, params.id);
    else if (body.action === "never") await neverSplitTransaction(user.id, params.id);
    else if (body.action === "match") {
      if (!body.billId) return NextResponse.json({ error: "billId required" }, { status: 400 });
      await matchTransaction(user.id, params.id, body.billId);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json(await clientState(user.id));
}

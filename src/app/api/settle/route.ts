import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { markNotificationsRead, settlePair, undoPair, clientState } from "@/lib/data/repo";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as {
    action: "tag" | "undo" | "read";
    from?: string;
    to?: string;
    creatorId?: string;
  };
  try {
    if (body.action === "read") {
      await markNotificationsRead(user.id);
      return NextResponse.json(await clientState(user.id));
    }
    if (!body.from || !body.to || !body.creatorId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (body.action === "undo") {
      return NextResponse.json(await undoPair(user.id, body.from, body.to, body.creatorId));
    }
    return NextResponse.json(await settlePair(user.id, body.from, body.to, body.creatorId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

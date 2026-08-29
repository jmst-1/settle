import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { captureInbox, clientState } from "@/lib/data/repo";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { label?: string; imagePath?: string };
  await captureInbox(user.id, { label: body.label || "Receipt", imagePath: body.imagePath });
  return NextResponse.json(await clientState(user.id));
}

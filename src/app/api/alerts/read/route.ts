import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { markSuggestedRead, clientState } from "@/lib/data/repo";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await markSuggestedRead(user.id);
  return NextResponse.json(await clientState(user.id));
}

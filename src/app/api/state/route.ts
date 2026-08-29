import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { clientState } from "@/lib/data/repo";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await clientState(user.id);
  if (!state) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(state);
}

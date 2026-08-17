import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { setProfile, clientState } from "@/lib/data/repo";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, paynow } = (await req.json()) as { name?: string; paynow?: string };
  const state = await setProfile(user.id, name || user.name, paynow ?? user.paynow);
  return NextResponse.json(state ?? (await clientState(user.id)));
}

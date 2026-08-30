import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { disconnectGmail } from "@/lib/alerts/gmail";
import { clientState } from "@/lib/data/repo";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await disconnectGmail(user.id);
  return NextResponse.json(await clientState(user.id));
}

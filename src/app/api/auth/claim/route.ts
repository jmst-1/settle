import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { claimToken } from "@/lib/data/repo";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = (await req.json()) as { token?: string };
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });
  const state = await claimToken(user.id, token);
  return NextResponse.json(state);
}

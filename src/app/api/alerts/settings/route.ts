import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { clientState, getAlertSettings, updateAlertSettings } from "@/lib/data/repo";
import type { AlertSettings } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ settings: await getAlertSettings(user.id) });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as Partial<AlertSettings>;
  const patch: Partial<AlertSettings> = {};
  if (typeof body.amountThreshold === "number" && body.amountThreshold >= 0) {
    patch.amountThreshold = body.amountThreshold;
  }
  if (typeof body.diningOnly === "boolean") patch.diningOnly = body.diningOnly;
  if (typeof body.emailBack === "boolean") patch.emailBack = body.emailBack;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  await updateAlertSettings(user.id, patch);
  return NextResponse.json(await clientState(user.id));
}

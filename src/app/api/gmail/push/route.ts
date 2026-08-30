import { NextResponse } from "next/server";
import { appOrigin, cronAuthorized } from "@/lib/config";
import { decodePubSubEmail, syncByGmailAddress } from "@/lib/alerts/gmail";

export async function POST(req: Request) {
  if (process.env.CRON_SECRET && !cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const email = decodePubSubEmail(body);
  if (!email) return NextResponse.json({ ok: true, skipped: true });
  try {
    await syncByGmailAddress(email, appOrigin(req));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

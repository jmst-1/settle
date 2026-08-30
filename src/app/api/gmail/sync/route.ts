import { NextResponse } from "next/server";
import { appOrigin, cronAuthorized } from "@/lib/config";
import { getSessionUser } from "@/lib/session";
import { syncAllGmail, syncGmailForUser } from "@/lib/alerts/gmail";
import { gmailOAuthConfigured } from "@/lib/alerts/email-back";

export async function POST(req: Request) {
  const cron = cronAuthorized(req);
  const user = cron ? null : await getSessionUser();
  if (!cron && !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!gmailOAuthConfigured()) {
    return NextResponse.json({ error: "Gmail OAuth is not configured" }, { status: 501 });
  }
  const origin = appOrigin(req);
  try {
    if (cron) {
      const results = await syncAllGmail(origin);
      return NextResponse.json({ ok: true, results });
    }
    const result = await syncGmailForUser(user!.id, { origin });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

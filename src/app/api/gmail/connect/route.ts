import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { appOrigin } from "@/lib/config";
import { gmailOAuthConfigured } from "@/lib/alerts/email-back";
import { gmailAuthUrl } from "@/lib/alerts/gmail";
import { signState } from "@/lib/crypto/token";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!gmailOAuthConfigured()) {
    return NextResponse.json({ error: "Gmail OAuth is not configured" }, { status: 501 });
  }
  const origin = appOrigin(req);
  const state = signState({ userId: user.id });
  const res = NextResponse.redirect(gmailAuthUrl(origin, state));
  res.cookies.set("splittab_gmail_oauth", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 20 * 60,
  });
  return res;
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/session";
import { appOrigin } from "@/lib/config";
import { completeGmailConnect } from "@/lib/alerts/gmail";
import { readState } from "@/lib/crypto/token";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = appOrigin(req);
  const errRedirect = new URL("/settings?gmail=error", origin);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || cookies().get("splittab_gmail_oauth")?.value;
  if (!code || !state) {
    return NextResponse.redirect(errRedirect);
  }
  let userId = "";
  try {
    const parsed = readState<{ userId: string }>(state);
    userId = parsed.userId;
  } catch {
    return NextResponse.redirect(errRedirect);
  }
  const session = await getSessionUser();
  if (session && session.id !== userId) {
    return NextResponse.redirect(errRedirect);
  }
  try {
    await completeGmailConnect(userId, code, origin);
  } catch (e) {
    const fail = new URL("/settings?gmail=error", origin);
    fail.searchParams.set("reason", (e as Error).message.slice(0, 120));
    const res = NextResponse.redirect(fail);
    res.cookies.delete("splittab_gmail_oauth");
    return res;
  }
  const res = NextResponse.redirect(new URL("/settings?gmail=connected", origin));
  res.cookies.delete("splittab_gmail_oauth");
  return res;
}

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isMemoryBackend } from "@/lib/config";
import { ensureUser, findUserByEmail, claimToken } from "@/lib/data/repo";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; claim?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  if (!isMemoryBackend()) {
    const supabase = createServerSupabase();
    if (!supabase) return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
    const origin = new URL(req.url).origin;
    const next = body.claim ? `/?claim=${encodeURIComponent(body.claim)}` : "/";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ sent: true, mode: "email" });
  }

  const local = email.split("@")[0] || "You";
  const name = local.charAt(0).toUpperCase() + local.slice(1);
  const existing = await findUserByEmail(email);
  const user = existing
    ? existing
    : await ensureUser({
        id: crypto.randomUUID(),
        email,
        name,
      });
  setSessionCookie(user.id);
  if (body.claim) await claimToken(user.id, body.claim);
  return NextResponse.json({ sent: true, mode: "demo", user });
}

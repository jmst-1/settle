import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/data/repo";
import { setSessionCookie } from "@/lib/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  const supabase = createServerSupabase();
  if (code && supabase) {
    await supabase.auth.exchangeCodeForSession(code);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const email = user.email ?? "";
      const name =
        (user.user_metadata?.display_name as string | undefined) ||
        email.split("@")[0] ||
        "You";
      await ensureUser({ id: user.id, email, name });
      setSessionCookie(user.id);
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

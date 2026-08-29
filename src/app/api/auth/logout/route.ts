import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  const supabase = createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}

import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { SESSION_COOKIE, isMemoryBackend } from "@/lib/config";
import { ensureUser, getUser } from "@/lib/data/repo";
import type { Member } from "@/lib/types";

export { SESSION_COOKIE };

export async function getSessionUser(): Promise<Member | null> {
  if (!isMemoryBackend()) {
    const supabase = createServerSupabase();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const email = user.email ?? "";
        const name =
          (user.user_metadata?.display_name as string | undefined) ||
          email.split("@")[0] ||
          "You";
        return ensureUser({
          id: user.id,
          email,
          name,
          paynow: (user.user_metadata?.paynow as string | undefined) ?? "",
        });
      }
    }
  }

  const uid = cookies().get(SESSION_COOKIE)?.value;
  if (!uid) return null;
  return getUser(uid);
}

export function setSessionCookie(userId: string) {
  cookies().set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_COOKIE } from "@/lib/config";

function isPublic(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/portal")) return true;
  if (pathname.startsWith("/settle/")) return true;
  if (pathname === "/manifest.json" || pathname === "/manifest.webmanifest") return true;
  if (pathname.startsWith("/sw") || pathname.startsWith("/workbox") || pathname.startsWith("/worker")) return true;
  if (pathname === "/favicon.ico" || pathname.startsWith("/icons")) return true;
  if (pathname.startsWith("/_next")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const memoryUid = req.cookies.get(SESSION_COOKIE)?.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    let response = NextResponse.next({ request: req });
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user || memoryUid) return response;
  } else if (memoryUid) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

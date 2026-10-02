import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie-name";

// Lightweight gate: check cookie presence + redirect anonymous users away from admin.
// Real auth (signature verify + DB lookup) happens in server components / API handlers.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);

  // Admin area requires a session.
  if (pathname.startsWith("/admin") && !hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("reason", "auth_required");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // guard admin area
    "/admin/:path*",
  ],
};

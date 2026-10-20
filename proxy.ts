import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie-name";

// Lightweight gate: check cookie presence + redirect anonymous users away from protected areas.
// Real auth (signature verify + DB lookup) happens in server components / API handlers.

// Routes that require NO session (redirect to /app if already logged in)
const GUEST_ONLY_PATHS = ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);

  // Already logged in → no need to see login/register again
  if (hasCookie && GUEST_ONLY_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  // Not logged in + protected route → send to login (auth pages themselves are always accessible)
  if (!hasCookie && !GUEST_ONLY_PATHS.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Pass pathname so layouts can read it in server components.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/auth/:path*", "/manage/:path*", "/app", "/app/:path*"]
};

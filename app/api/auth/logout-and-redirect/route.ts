import { clearSessionCookie } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  await clearSessionCookie();
  const url = new URL("/auth/login", req.url);
  return NextResponse.redirect(url);
}

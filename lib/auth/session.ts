import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./cookie-name";

const COOKIE_NAME = SESSION_COOKIE_NAME;
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  uid: string;
  exp: number; // unix seconds
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET must be set to a random 16+ char string");
  }
  return s;
}

function base64url(input: Buffer | string): string {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString("base64url");
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function sign(body: string): string {
  return base64url(createHmac("sha256", secret()).update(body).digest());
}

export function encodeSession(payload: SessionPayload): string {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string): SessionPayload | null {
  const idx = token.indexOf(".");
  if (idx < 0) return null;
  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(body);
  const a = fromBase64url(sig);
  const b = fromBase64url(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromBase64url(body).toString("utf8")) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const token = encodeSession({ uid: userId, exp });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export { SESSION_COOKIE_NAME };

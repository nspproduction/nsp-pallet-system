"use client";

import type { Liff } from "@line/liff";

let liffPromise: Promise<Liff> | null = null;

export type LiffStep = "env" | "config" | "init" | "login";

export class LiffError extends Error {
  step: LiffStep;
  cause?: unknown;
  constructor(step: LiffStep, message: string, cause?: unknown) {
    super(message);
    this.name = "LiffError";
    this.step = step;
    this.cause = cause;
  }
}

export function getLiff(): Promise<Liff> {
  if (typeof window === "undefined") {
    throw new LiffError("env", "getLiff() must be called on the client");
  }
  if (!liffPromise) {
    liffPromise = (async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        throw new LiffError(
          "config",
          "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID ในไฟล์ .env.local (แล้ว restart dev server)"
        );
      }
      try {
        const mod = await import("@line/liff");
        const liff = mod.default;
        await liff.init({ liffId });
        return liff;
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        // Common LIFF init error hints
        let hint = "";
        if (/invalid|not found|liff_id/i.test(raw)) {
          hint = " ตรวจสอบว่า LIFF ID ถูกต้อง และ LIFF app ถูก publish แล้ว";
        } else if (/network|failed to fetch/i.test(raw)) {
          hint = " ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต";
        }
        throw new LiffError("init", `เริ่มต้น LIFF ไม่สำเร็จ: ${raw}.${hint}`, e);
      }
    })();
  }
  return liffPromise;
}

export async function ensureLoggedIn(): Promise<Liff> {
  const liff = await getLiff();
  if (!liff.isLoggedIn()) {
    try {
      // No redirectUri: LIFF SDK will use the Endpoint URL registered in LINE Console.
      // Passing an arbitrary redirectUri (e.g. window.location.href) causes 400 Bad Request
      // unless it's a sub-path of the registered endpoint.
      liff.login();
    } catch (e) {
      throw new LiffError(
        "login",
        `เรียก LINE login ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`,
        e
      );
    }
    // liff.login() navigates the browser away. Block here so callers don't proceed.
    await new Promise<never>(() => {});
  }
  return liff;
}

import { describe, it, expect } from "vitest";

import { validateReturnSource } from "@/lib/services/request";

describe("validateReturnSource", () => {
  it("RETURN + dept requires it → must be provided, returns value", () => {
    expect(validateReturnSource("RETURN", true, "INTERNAL")).toBe("INTERNAL");
    expect(validateReturnSource("RETURN", true, "CUSTOMER")).toBe("CUSTOMER");
  });

  it("RETURN + dept requires it + source missing → throws", () => {
    expect(() => validateReturnSource("RETURN", true, null)).toThrow(/ต้องระบุที่มา/);
  });

  it("RETURN + dept does NOT require it → defaults to INTERNAL", () => {
    expect(validateReturnSource("RETURN", false, null)).toBe("INTERNAL");
    // Even if the client sends a value, it's dropped and INTERNAL is used —
    // tolerate this because the dept flag may have been toggled off after
    // the form was opened.
    expect(validateReturnSource("RETURN", false, "CUSTOMER")).toBe("INTERNAL");
  });

  it("ISSUE + source provided → throws (source only valid on RETURN)", () => {
    expect(() => validateReturnSource("ISSUE", false, "INTERNAL")).toThrow(/เฉพาะกับคำขอคืน/);
    expect(() => validateReturnSource("ISSUE", true, "CUSTOMER")).toThrow(/เฉพาะกับคำขอคืน/);
  });

  it("ISSUE + no source → returns null", () => {
    expect(validateReturnSource("ISSUE", false, null)).toBeNull();
    expect(validateReturnSource("ISSUE", true, null)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Unit tests for approval-route pure helpers (no DB)
// ──────────────────────────────────────────────────────────────────────────────

import { findActableStep } from "@/lib/services/approval-route";
import type { StepSnapshot } from "@/lib/services/approval-route";

const STEPS: StepSnapshot[] = [
  { stepOrder: 1, name: "หัวหน้าแผนก", approverIds: ["user-a", "user-b"] },
  { stepOrder: 2, name: "ผู้จัดการ", approverIds: ["user-c"] },
];

describe("findActableStep", () => {
  it("returns null when currentStepOrder is null", () => {
    expect(findActableStep(STEPS, null, "user-a")).toBeNull();
  });

  it("returns null when user is not in the step's approverIds", () => {
    expect(findActableStep(STEPS, 1, "user-c")).toBeNull();
  });

  it("returns null when step order does not exist in snapshot", () => {
    expect(findActableStep(STEPS, 99, "user-a")).toBeNull();
  });

  it("returns the step when user is in approverIds and currentStepOrder matches", () => {
    const step = findActableStep(STEPS, 1, "user-a");
    expect(step).not.toBeNull();
    expect(step?.stepOrder).toBe(1);
    expect(step?.name).toBe("หัวหน้าแผนก");
  });

  it("returns step 2 for user-c when currentStepOrder is 2", () => {
    const step = findActableStep(STEPS, 2, "user-c");
    expect(step?.stepOrder).toBe(2);
  });

  it("does not return a later step when an earlier step is current", () => {
    // user-c is approver for step 2, but current step is 1
    expect(findActableStep(STEPS, 1, "user-c")).toBeNull();
  });

  it("handles empty snapshot", () => {
    expect(findActableStep([], 1, "user-a")).toBeNull();
  });
});

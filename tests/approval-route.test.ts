import { describe, it, expect } from "vitest";

import { narrowStepsByPicks } from "@/lib/services/approval-route";
import type { StepSnapshot } from "@/lib/services/approval-route";

const REQUESTER_ID = "u-req";

function step(partial: Partial<StepSnapshot> & { stepOrder: number }): StepSnapshot {
  return {
    name: `ขั้น ${partial.stepOrder}`,
    approverIds: [],
    requesterPicks: false,
    ...partial,
  };
}

describe("narrowStepsByPicks", () => {
  it("passes steps through unchanged when requesterPicks=false", () => {
    const steps = [step({ stepOrder: 1, approverIds: ["a", "b", "c"] })];
    const result = narrowStepsByPicks(steps, [], REQUESTER_ID);
    expect(result[0].approverIds).toEqual(["a", "b", "c"]);
  });

  it("auto-selects (passes through) when requesterPicks=true but only 1 approver", () => {
    const steps = [step({ stepOrder: 1, approverIds: ["a"], requesterPicks: true })];
    const result = narrowStepsByPicks(steps, undefined, REQUESTER_ID);
    expect(result[0].approverIds).toEqual(["a"]);
  });

  it("narrows approverIds to the chosen approver when pick is supplied", () => {
    const steps = [step({ stepOrder: 1, approverIds: ["a", "b", "c"], requesterPicks: true })];
    const result = narrowStepsByPicks(steps, [{ stepOrder: 1, approverId: "b" }], REQUESTER_ID);
    expect(result[0].approverIds).toEqual(["b"]);
    expect(result[0].requesterPicks).toBe(true);
  });

  it("only narrows requesterPicks steps — leaves others unchanged", () => {
    const steps = [
      step({ stepOrder: 1, approverIds: ["a", "b"], requesterPicks: true }),
      step({ stepOrder: 2, approverIds: ["x", "y"], requesterPicks: false }),
    ];
    const result = narrowStepsByPicks(steps, [{ stepOrder: 1, approverId: "a" }], REQUESTER_ID);
    expect(result[0].approverIds).toEqual(["a"]);
    expect(result[1].approverIds).toEqual(["x", "y"]);
  });

  it("throws when a pick is missing for a required step", () => {
    const steps = [step({ stepOrder: 1, approverIds: ["a", "b"], requesterPicks: true })];
    expect(() => narrowStepsByPicks(steps, [], REQUESTER_ID)).toThrow(/กรุณาเลือก/);
  });

  it("throws when the picked approver is not in the step's approverIds", () => {
    const steps = [step({ stepOrder: 1, approverIds: ["a", "b"], requesterPicks: true })];
    expect(() =>
      narrowStepsByPicks(steps, [{ stepOrder: 1, approverId: "z" }], REQUESTER_ID)
    ).toThrow(/ไม่ได้อยู่ในรายชื่อ/);
  });

  it("throws when the requester tries to pick themselves (would deadlock)", () => {
    const steps = [step({ stepOrder: 1, approverIds: [REQUESTER_ID, "a"], requesterPicks: true })];
    expect(() =>
      narrowStepsByPicks(steps, [{ stepOrder: 1, approverId: REQUESTER_ID }], REQUESTER_ID)
    ).toThrow(/ตัวเอง/);
  });
});

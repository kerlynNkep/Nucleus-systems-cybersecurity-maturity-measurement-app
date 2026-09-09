import { describe, expect, it } from "vitest";

import {
  buildRegisterView,
  computeRegisterTrigger,
  TRIGGER_PRIORITY,
  type RegisterEvaluationInput,
} from "../register";
import { computeMandateShortfall } from "../mandate-shortfall";

function baseInput(overrides: Partial<RegisterEvaluationInput> = {}): RegisterEvaluationInput {
  return {
    gap: 2,
    decision: null,
    remediationStatus: "not_started",
    targetDate: null,
    now: new Date("2026-09-09"),
    isFoundational: false,
    maturityLevel: 2,
    mandateShortfall: false,
    lifecycleState: "assessed",
    ...overrides,
  };
}

describe("computeRegisterTrigger", () => {
  it("does not register a gap with none of the five conditions", () => {
    expect(computeRegisterTrigger(baseInput())).toBeNull();
  });

  it("does not register when there is no gap", () => {
    expect(computeRegisterTrigger(baseInput({ gap: 0 }))).toBeNull();
    expect(computeRegisterTrigger(baseInput({ gap: null }))).toBeNull();
  });

  it("never registers a closed item, even if a trigger would otherwise fire", () => {
    expect(
      computeRegisterTrigger(
        baseInput({ decision: "accepted", lifecycleState: "closed" }),
      ),
    ).toBeNull();
  });

  it("fires DEFERRED when remediation is explicitly deferred", () => {
    expect(computeRegisterTrigger(baseInput({ decision: "deferred" }))).toBe("DEFERRED");
  });

  it("fires ACCEPTED when the client declines to remediate", () => {
    expect(computeRegisterTrigger(baseInput({ decision: "accepted" }))).toBe("ACCEPTED");
  });

  it("fires MANDATE_SHORTFALL when a cited regulation the client is in scope for is unmet", () => {
    expect(computeRegisterTrigger(baseInput({ mandateShortfall: true }))).toBe(
      "MANDATE_SHORTFALL",
    );
  });

  it("fires FOUNDATIONAL_ABSENCE only when foundational AND rated L1", () => {
    expect(
      computeRegisterTrigger(baseInput({ isFoundational: true, maturityLevel: 1 })),
    ).toBe("FOUNDATIONAL_ABSENCE");
    expect(
      computeRegisterTrigger(baseInput({ isFoundational: true, maturityLevel: 2 })),
    ).toBeNull();
    expect(
      computeRegisterTrigger(baseInput({ isFoundational: false, maturityLevel: 1 })),
    ).toBeNull();
  });

  it("fires OVERDUE when a committed remediation item passed its target date", () => {
    expect(
      computeRegisterTrigger(
        baseInput({
          remediationStatus: "in_progress",
          targetDate: new Date("2026-01-01"),
          now: new Date("2026-09-09"),
        }),
      ),
    ).toBe("OVERDUE");
  });

  it("does not fire OVERDUE for a completed remediation past its target date", () => {
    expect(
      computeRegisterTrigger(
        baseInput({
          remediationStatus: "complete",
          targetDate: new Date("2026-01-01"),
          now: new Date("2026-09-09"),
        }),
      ),
    ).toBeNull();
  });

  it("does not fire OVERDUE before the target date arrives", () => {
    expect(
      computeRegisterTrigger(
        baseInput({
          remediationStatus: "in_progress",
          targetDate: new Date("2027-01-01"),
          now: new Date("2026-09-09"),
        }),
      ),
    ).toBeNull();
  });

  describe("priority ordering when multiple triggers fire at once", () => {
    it("MANDATE_SHORTFALL outranks everything else", () => {
      expect(
        computeRegisterTrigger(
          baseInput({
            mandateShortfall: true,
            isFoundational: true,
            maturityLevel: 1,
            decision: "accepted",
            remediationStatus: "in_progress",
            targetDate: new Date("2020-01-01"),
          }),
        ),
      ).toBe("MANDATE_SHORTFALL");
    });

    it("FOUNDATIONAL_ABSENCE outranks OVERDUE, DEFERRED and ACCEPTED", () => {
      expect(
        computeRegisterTrigger(
          baseInput({
            isFoundational: true,
            maturityLevel: 1,
            decision: "deferred",
            remediationStatus: "in_progress",
            targetDate: new Date("2020-01-01"),
          }),
        ),
      ).toBe("FOUNDATIONAL_ABSENCE");
    });

    it("OVERDUE outranks DEFERRED and ACCEPTED", () => {
      expect(
        computeRegisterTrigger(
          baseInput({
            decision: "accepted",
            remediationStatus: "in_progress",
            targetDate: new Date("2020-01-01"),
          }),
        ),
      ).toBe("OVERDUE");
    });

    it("DEFERRED outranks ACCEPTED", () => {
      // Not directly reachable since decision is a single field in our
      // model, but the priority list itself must still be ordered this way.
      expect(TRIGGER_PRIORITY.indexOf("DEFERRED")).toBeLessThan(
        TRIGGER_PRIORITY.indexOf("ACCEPTED"),
      );
    });
  });
});

describe("buildRegisterView", () => {
  it("filters out non-firing items and sorts firing ones by trigger priority", () => {
    const items = [
      { id: "a", decision: "accepted" as const },
      { id: "b", mandateShortfall: true },
      { id: "c" }, // no trigger — excluded
      { id: "d", isFoundational: true, maturityLevel: 1 },
    ];
    const view = buildRegisterView(items, (item) =>
      baseInput({
        decision: "decision" in item ? item.decision! : null,
        mandateShortfall: "mandateShortfall" in item ? true : false,
        isFoundational: "isFoundational" in item ? true : false,
        maturityLevel: "maturityLevel" in item ? item.maturityLevel! : 2,
      }),
    );
    expect(view.map((v) => v.id)).toEqual(["b", "d", "a"]);
    expect(view.map((v) => v.trigger)).toEqual([
      "MANDATE_SHORTFALL",
      "FOUNDATIONAL_ABSENCE",
      "ACCEPTED",
    ]);
  });
});

describe("computeMandateShortfall", () => {
  it("is true when a mandated standard is in scope and the control is below the floor", () => {
    expect(
      computeMandateShortfall({
        maturityLevel: 1,
        citedStandardNames: ["GDPR", "ISO 27001"],
        scopingAnswers: { Q1: true },
      }),
    ).toBe(true);
  });

  it("is false when the client is not in scope for the cited regulation", () => {
    expect(
      computeMandateShortfall({
        maturityLevel: 1,
        citedStandardNames: ["DORA"],
        scopingAnswers: { Q3: false },
      }),
    ).toBe(false);
  });

  it("is false when the control already meets the mandated floor", () => {
    expect(
      computeMandateShortfall({
        maturityLevel: 3,
        citedStandardNames: ["GDPR"],
        scopingAnswers: { Q1: true },
      }),
    ).toBe(false);
  });

  it("is false when the citation isn't a regulation we map to a scoping question", () => {
    expect(
      computeMandateShortfall({
        maturityLevel: 1,
        citedStandardNames: ["NIST CSF"],
        scopingAnswers: {},
      }),
    ).toBe(false);
  });
});

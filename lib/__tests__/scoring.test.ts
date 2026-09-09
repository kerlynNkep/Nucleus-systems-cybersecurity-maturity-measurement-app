import { describe, expect, it } from "vitest";

import { deriveGap, rollupDomain, rollupOverall, type RatedControl } from "../scoring";

function control(overrides: Partial<RatedControl>): RatedControl {
  return { inScope: true, maturityLevel: null, targetLevel: null, ...overrides };
}

describe("rollupDomain", () => {
  it("averages only rated, in-scope controls", () => {
    const rollup = rollupDomain({
      domainId: "d1",
      weight: 0.16,
      controls: [
        control({ maturityLevel: 1, targetLevel: 3 }),
        control({ maturityLevel: 2, targetLevel: 3 }),
        control({ maturityLevel: 3, targetLevel: 4 }),
      ],
    });
    expect(rollup.currentAvg).toBeCloseTo(2, 5);
    expect(rollup.targetAvg).toBeCloseTo(10 / 3, 5);
    expect(rollup.gap).toBeCloseTo(10 / 3 - 2, 5);
  });

  it("excludes out-of-scope controls entirely from the average — they must not drag it down", () => {
    const withoutExclusion = rollupDomain({
      domainId: "d1",
      weight: 0.16,
      controls: [control({ maturityLevel: 4 }), control({ maturityLevel: 4 })],
    });
    const withExclusion = rollupDomain({
      domainId: "d1",
      weight: 0.16,
      controls: [
        control({ maturityLevel: 4 }),
        control({ maturityLevel: 4 }),
        // An excluded control rated L1 (e.g. a stale rating from before
        // exclusion) must not pull the average toward 1.
        control({ inScope: false, maturityLevel: 1 }),
      ],
    });
    expect(withExclusion.currentAvg).toBe(withoutExclusion.currentAvg);
    expect(withExclusion.currentAvg).toBeCloseTo(4, 5);
    expect(withExclusion.applicableCount).toBe(2);
  });

  it("skips in-scope but not-yet-rated controls — unrated is not the same as rated zero", () => {
    const rollup = rollupDomain({
      domainId: "d1",
      weight: 0.16,
      controls: [
        control({ maturityLevel: 3 }),
        control({ maturityLevel: null }), // in scope, just not rated yet
      ],
    });
    expect(rollup.currentAvg).toBe(3);
    expect(rollup.ratedCount).toBe(1);
    expect(rollup.applicableCount).toBe(2);
  });

  it("returns null averages when nothing is rated", () => {
    const rollup = rollupDomain({
      domainId: "d1",
      weight: 0.16,
      controls: [control({ maturityLevel: null }), control({ inScope: false })],
    });
    expect(rollup.currentAvg).toBeNull();
    expect(rollup.targetAvg).toBeNull();
    expect(rollup.gap).toBeNull();
  });
});

describe("rollupOverall", () => {
  it("normalizes by the sum of weights actually in play, not by 1.0 — replicating the source's own formula", () => {
    // NS-CMMF's real domain weights and per-domain averages, read directly
    // off the Acacia Dashboard sheet (full precision, not display-rounded).
    const domainRollups = [
      { domainId: "GV", weight: 0.16, currentAvg: 1.14814814814815, targetAvg: 3.37037037037037, gap: 2.22222222222222, ratedCount: 27, applicableCount: 27 },
      { domainId: "ID", weight: 0.1, currentAvg: 1.31578947368421, targetAvg: 3.47368421052632, gap: 2.15789473684211, ratedCount: 19, applicableCount: 19 },
      { domainId: "PR", weight: 0.26, currentAvg: 1.36, targetAvg: 3.46666666666667, gap: 2.10666666666667, ratedCount: 78, applicableCount: 78 },
      { domainId: "DE", weight: 0.14, currentAvg: 1.11111111111111, targetAvg: 3.38888888888889, gap: 2.27777777777778, ratedCount: 18, applicableCount: 18 },
      { domainId: "RS", weight: 0.11, currentAvg: 1.28571428571429, targetAvg: 3.42857142857143, gap: 2.14285714285714, ratedCount: 14, applicableCount: 14 },
      { domainId: "RC", weight: 0.1, currentAvg: 1.07142857142857, targetAvg: 3.21428571428571, gap: 2.14285714285714, ratedCount: 14, applicableCount: 14 },
    ];
    const overall = rollupOverall(domainRollups);
    // Expected values pulled directly from the Acacia Dashboard sheet's
    // own computed cells (E12/H12), which use the same Σ(w·avg)/Σ(w) formula.
    expect(overall.weightSum).toBeCloseTo(0.87, 5);
    expect(overall.currentAvg).toBeCloseTo(1.23334440827484, 6);
    expect(overall.targetAvg).toBeCloseTo(3.40342170880586, 6);

    // Sanity check: naively dividing by 1.0 instead of 0.87 would give a
    // materially different (and wrong) number.
    const naiveSum = domainRollups.reduce((s, d) => s + d.weight * d.currentAvg, 0);
    expect(overall.currentAvg).not.toBeCloseTo(naiveSum, 3);
  });

  it("excludes a domain with nothing rated yet from both numerator and denominator", () => {
    const overall = rollupOverall([
      { domainId: "GV", weight: 0.16, currentAvg: 2, targetAvg: 4, gap: 2, ratedCount: 27, applicableCount: 27 },
      { domainId: "ID", weight: 0.1, currentAvg: null, targetAvg: null, gap: null, ratedCount: 0, applicableCount: 19 },
    ]);
    expect(overall.currentAvg).toBe(2);
    expect(overall.targetAvg).toBe(4);
  });

  it("returns null when nothing anywhere is rated", () => {
    const overall = rollupOverall([
      { domainId: "GV", weight: 0.16, currentAvg: null, targetAvg: null, gap: null, ratedCount: 0, applicableCount: 27 },
    ]);
    expect(overall.currentAvg).toBeNull();
    expect(overall.targetAvg).toBeNull();
  });
});

describe("deriveGap", () => {
  it("computes target minus current", () => {
    expect(deriveGap(1, 3)).toBe(2);
    expect(deriveGap(4, 3)).toBe(-1);
  });

  it("is null when either side is unset", () => {
    expect(deriveGap(null, 3)).toBeNull();
    expect(deriveGap(1, null)).toBeNull();
  });
});

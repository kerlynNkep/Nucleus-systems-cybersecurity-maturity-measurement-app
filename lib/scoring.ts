/**
 * Pure scoring/rollup functions — no DB, no framework hardcoded. Mirrors
 * the source workbook's Dashboard formulas exactly, including the one
 * detail that's easy to get wrong: domain weights in the source data do
 * NOT sum to 1.0 (NS-CMMF's sum to 0.87), and the workbook's own
 * SUMPRODUCT-style formula compensates by dividing by the sum of the
 * weights actually in play, rather than assuming they're normalized.
 * See SHORTFALLS.md.
 */

export type RatedControl = {
  inScope: boolean;
  maturityLevel: number | null;
  targetLevel: number | null;
};

export type DomainRollupInput = {
  domainId: string;
  weight: number;
  controls: RatedControl[];
};

export type DomainRollup = {
  domainId: string;
  weight: number;
  currentAvg: number | null;
  targetAvg: number | null;
  gap: number | null;
  ratedCount: number;
  applicableCount: number;
};

/**
 * Average over in-scope controls only, and only over controls that have
 * actually been rated — an excluded control is never in the denominator,
 * and neither is one that just hasn't been rated yet ("Controls Rated
 * %" on the source Dashboard reports this same distinction).
 */
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function rollupDomain(input: DomainRollupInput): DomainRollup {
  const applicable = input.controls.filter((c) => c.inScope);
  const currentValues = applicable
    .map((c) => c.maturityLevel)
    .filter((v): v is number => v != null);
  const targetValues = applicable
    .map((c) => c.targetLevel)
    .filter((v): v is number => v != null);

  const currentAvg = average(currentValues);
  const targetAvg = average(targetValues);

  return {
    domainId: input.domainId,
    weight: input.weight,
    currentAvg,
    targetAvg,
    gap: currentAvg != null && targetAvg != null ? targetAvg - currentAvg : null,
    ratedCount: currentValues.length,
    applicableCount: applicable.length,
  };
}

export type OverallRollup = {
  currentAvg: number | null;
  targetAvg: number | null;
  weightSum: number;
};

/**
 * Weighted overall = Σ(weight × avg) / Σ(weight), summed only over
 * domains that have an average to contribute (i.e. at least one rated,
 * in-scope control) — a domain with nothing rated yet must not silently
 * count as a zero and drag the overall average down. The source
 * workbook never exercised this edge case (Acacia always had all 188
 * controls rated across all 6 domains); this is our extrapolation of its
 * "don't let excluded controls drag the average down" rule to the case
 * of a wholly-unrated domain, which is the normal state for every
 * domain but GV in this prototype.
 */
export function rollupOverall(domainRollups: DomainRollup[]): OverallRollup {
  const withCurrent = domainRollups.filter((d) => d.currentAvg != null);
  const withTarget = domainRollups.filter((d) => d.targetAvg != null);

  const currentWeightSum = withCurrent.reduce((s, d) => s + d.weight, 0);
  const targetWeightSum = withTarget.reduce((s, d) => s + d.weight, 0);

  const currentAvg =
    currentWeightSum > 0
      ? withCurrent.reduce((s, d) => s + d.weight * d.currentAvg!, 0) / currentWeightSum
      : null;
  const targetAvg =
    targetWeightSum > 0
      ? withTarget.reduce((s, d) => s + d.weight * d.targetAvg!, 0) / targetWeightSum
      : null;

  return {
    currentAvg,
    targetAvg,
    weightSum: domainRollups.reduce((s, d) => s + d.weight, 0),
  };
}

export function deriveGap(maturityLevel: number | null, targetLevel: number | null): number | null {
  if (maturityLevel == null || targetLevel == null) return null;
  return targetLevel - maturityLevel;
}

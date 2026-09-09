import { db } from "@/db/client";
import { controlStandardCitations, cycleScopingAnswers, levelDescriptions, recommendations, scopingQuestions, standards } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

import { getCycleControls, getDomainsForFramework } from "@/lib/queries";
import { rollupDomain, rollupOverall, deriveGap, type DomainRollup } from "@/lib/scoring";
import { computeMandateShortfall } from "@/lib/mandate-shortfall";
import { buildRegisterView, type RegisterEntry } from "@/lib/register";

export type EnrichedCycleControl = Awaited<ReturnType<typeof getCycleControls>>[number] & {
  gap: number | null;
  levelDescription: string | null;
  recommendationText: string | null;
  citedStandardNames: string[];
};

export async function getEnrichedCycleControls(cycleId: string): Promise<EnrichedCycleControl[]> {
  const rows = await getCycleControls(cycleId);
  const controlIds = rows.map((r) => r.control.id);
  if (controlIds.length === 0) return [];

  const [levelDescs, recs, citations] = await Promise.all([
    db.select().from(levelDescriptions).where(inArray(levelDescriptions.controlId, controlIds)),
    db.select().from(recommendations).where(inArray(recommendations.controlId, controlIds)),
    db
      .select({
        controlId: controlStandardCitations.controlId,
        standardName: standards.name,
        isMandatory: controlStandardCitations.isMandatory,
      })
      .from(controlStandardCitations)
      .innerJoin(standards, eq(standards.id, controlStandardCitations.standardId))
      .where(inArray(controlStandardCitations.controlId, controlIds)),
  ]);

  const levelDescByControlAndLevel = new Map(
    levelDescs.map((ld) => [`${ld.controlId}:${ld.levelValue}`, ld.description]),
  );
  const recByControlAndTarget = new Map(recs.map((r) => [`${r.controlId}:${r.targetLevel}`, r.text]));
  const citationsByControl = new Map<string, string[]>();
  for (const c of citations) {
    if (!c.isMandatory) continue;
    const list = citationsByControl.get(c.controlId) ?? [];
    list.push(c.standardName);
    citationsByControl.set(c.controlId, list);
  }

  return rows.map((row) => {
    const maturityLevel = row.rating?.maturityLevel ?? null;
    const targetLevel = row.rating?.targetLevel ?? null;
    const gap = deriveGap(maturityLevel, targetLevel);
    return {
      ...row,
      gap,
      levelDescription:
        maturityLevel != null
          ? levelDescByControlAndLevel.get(`${row.control.id}:${maturityLevel}`) ?? null
          : null,
      recommendationText:
        gap != null && gap <= 0
          ? "Target met — sustain evidence and raise target when programme allows."
          : targetLevel != null
            ? recByControlAndTarget.get(`${row.control.id}:${targetLevel}`) ?? null
            : null,
      citedStandardNames: citationsByControl.get(row.control.id) ?? [],
    };
  });
}

export type DomainRollupWithMeta = DomainRollup & { domainCode: string; domainName: string };

export async function getRollups(cycleId: string, frameworkId: string) {
  const enriched = await getEnrichedCycleControls(cycleId);
  const allDomains = await getDomainsForFramework(frameworkId);

  const byDomain = new Map<string, typeof enriched>();
  for (const row of enriched) {
    const list = byDomain.get(row.domainId) ?? [];
    list.push(row);
    byDomain.set(row.domainId, list);
  }

  const domainRollups: DomainRollupWithMeta[] = allDomains
    .filter((d) => byDomain.has(d.id))
    .map((d) => {
      const rows = byDomain.get(d.id)!;
      const rollup = rollupDomain({
        domainId: d.id,
        weight: Number(d.weight),
        controls: rows.map((r) => ({
          inScope: r.inScope,
          maturityLevel: r.rating?.maturityLevel ?? null,
          targetLevel: r.rating?.targetLevel ?? null,
        })),
      });
      return { ...rollup, domainCode: d.code, domainName: d.name };
    });

  const overall = rollupOverall(domainRollups);
  return { domainRollups, overall, enriched };
}

/** Register view for a cycle: every remediation item whose gap is still open, evaluated against the five promotion triggers. */
export async function getRegisterEntries(cycleId: string): Promise<RegisterEntry<EnrichedCycleControl>[]> {
  const enriched = await getEnrichedCycleControls(cycleId);
  const withRemediation = enriched.filter((r) => r.remediation != null);

  const answers = await db
    .select({ code: scopingQuestions.code, answer: cycleScopingAnswers.answer })
    .from(cycleScopingAnswers)
    .innerJoin(scopingQuestions, eq(scopingQuestions.id, cycleScopingAnswers.scopingQuestionId))
    .where(eq(cycleScopingAnswers.cycleId, cycleId));
  const scopingAnswers: Record<string, boolean | null> = {};
  for (const a of answers) scopingAnswers[a.code] = a.answer;

  const now = new Date();

  return buildRegisterView(withRemediation, (row) => {
    const mandateShortfall = computeMandateShortfall({
      maturityLevel: row.rating?.maturityLevel ?? null,
      citedStandardNames: row.citedStandardNames,
      scopingAnswers,
    });
    return {
      gap: row.gap,
      decision: row.remediation!.decision,
      remediationStatus: row.remediation!.status,
      targetDate: row.remediation!.reviewDate ? new Date(row.remediation!.reviewDate) : null,
      now,
      isFoundational: row.control.isFoundational,
      maturityLevel: row.rating?.maturityLevel ?? null,
      mandateShortfall,
      lifecycleState: row.remediation!.lifecycleState,
    };
  });
}

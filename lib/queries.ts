import { and, asc, desc, eq, isNull, or, gt } from "drizzle-orm";

import { db } from "@/db/client";
import {
  assessmentCycles,
  assessorReviews,
  clientTokens,
  clients,
  controlResponses,
  controlStandardCitations,
  controls,
  cycleControls,
  cycleScopingAnswers,
  domains,
  engagementFrameworks,
  engagements,
  frameworks,
  levelDescriptions,
  maturityScales,
  ratings,
  recommendations,
  remediationItems,
  scopingQuestions,
  standards,
} from "@/db/schema";

export async function getFrameworks() {
  return db.select().from(frameworks).orderBy(asc(frameworks.name));
}

export async function getEngagements() {
  return db
    .select({
      id: engagements.id,
      name: engagements.name,
      assessorName: engagements.assessorName,
      status: engagements.status,
      createdAt: engagements.createdAt,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(engagements)
    .innerJoin(clients, eq(clients.id, engagements.clientId))
    .orderBy(asc(clients.name));
}

export async function getEngagementDetail(engagementId: string) {
  const [engagement] = await db
    .select({
      id: engagements.id,
      name: engagements.name,
      assessorName: engagements.assessorName,
      status: engagements.status,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(engagements)
    .innerJoin(clients, eq(clients.id, engagements.clientId))
    .where(eq(engagements.id, engagementId));
  if (!engagement) return null;

  const engFrameworks = await db
    .select({
      id: engagementFrameworks.id,
      frameworkId: frameworks.id,
      frameworkCode: frameworks.code,
      frameworkName: frameworks.name,
    })
    .from(engagementFrameworks)
    .innerJoin(frameworks, eq(frameworks.id, engagementFrameworks.frameworkId))
    .where(eq(engagementFrameworks.engagementId, engagementId));

  const cyclesByFramework: Record<string, Awaited<ReturnType<typeof getCyclesForEngagementFramework>>> = {};
  for (const ef of engFrameworks) {
    cyclesByFramework[ef.id] = await getCyclesForEngagementFramework(ef.id);
  }

  return { engagement, engagementFrameworks: engFrameworks, cyclesByFramework };
}

export async function getCyclesForEngagementFramework(engagementFrameworkId: string) {
  return db
    .select()
    .from(assessmentCycles)
    .where(eq(assessmentCycles.engagementFrameworkId, engagementFrameworkId))
    .orderBy(asc(assessmentCycles.cycleNumber));
}

export async function getCycleContext(cycleId: string) {
  const [row] = await db
    .select({
      cycle: assessmentCycles,
      engagementFrameworkId: engagementFrameworks.id,
      frameworkId: frameworks.id,
      frameworkCode: frameworks.code,
      frameworkName: frameworks.name,
      assessmentUnitSingular: frameworks.assessmentUnitSingular,
      engagementId: engagements.id,
      engagementName: engagements.name,
      assessorName: engagements.assessorName,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(assessmentCycles)
    .innerJoin(engagementFrameworks, eq(engagementFrameworks.id, assessmentCycles.engagementFrameworkId))
    .innerJoin(frameworks, eq(frameworks.id, engagementFrameworks.frameworkId))
    .innerJoin(engagements, eq(engagements.id, engagementFrameworks.engagementId))
    .innerJoin(clients, eq(clients.id, engagements.clientId))
    .where(eq(assessmentCycles.id, cycleId));
  return row ?? null;
}

export async function getScopingQuestions(frameworkId: string) {
  return db
    .select()
    .from(scopingQuestions)
    .where(eq(scopingQuestions.frameworkId, frameworkId))
    .orderBy(asc(scopingQuestions.sortOrder));
}

export async function getCycleScopingAnswers(cycleId: string) {
  return db
    .select()
    .from(cycleScopingAnswers)
    .where(eq(cycleScopingAnswers.cycleId, cycleId));
}

export async function getMaturityScale(frameworkId: string) {
  return db
    .select()
    .from(maturityScales)
    .where(eq(maturityScales.frameworkId, frameworkId))
    .orderBy(asc(maturityScales.sortOrder));
}

export async function getDomainsForFramework(frameworkId: string) {
  return db
    .select()
    .from(domains)
    .where(eq(domains.frameworkId, frameworkId))
    .orderBy(asc(domains.sortOrder));
}

/**
 * The core join: every in-scope-or-not control for a cycle, with its
 * domain, response, review, rating and remediation state. This backs the
 * questionnaire, validation, rating, improvement-plan and register
 * views — they differ only in which columns they render and which rows
 * they filter to.
 */
export async function getCycleControls(cycleId: string) {
  const rows = await db
    .select({
      cycleControlId: cycleControls.id,
      inScope: cycleControls.inScope,
      exclusionReason: cycleControls.exclusionReason,
      control: controls,
      domainId: domains.id,
      domainCode: domains.code,
      domainName: domains.name,
      domainWeight: domains.weight,
      response: controlResponses,
      review: assessorReviews,
      rating: ratings,
      remediation: remediationItems,
    })
    .from(cycleControls)
    .innerJoin(controls, eq(controls.id, cycleControls.controlId))
    .innerJoin(domains, eq(domains.id, controls.domainId))
    .leftJoin(controlResponses, eq(controlResponses.cycleControlId, cycleControls.id))
    .leftJoin(assessorReviews, eq(assessorReviews.cycleControlId, cycleControls.id))
    .leftJoin(ratings, eq(ratings.cycleControlId, cycleControls.id))
    .leftJoin(remediationItems, eq(remediationItems.cycleControlId, cycleControls.id))
    .where(eq(cycleControls.cycleId, cycleId))
    .orderBy(asc(controls.sortOrder));
  return rows;
}

export async function getControlLevelDescriptions(controlId: string) {
  return db
    .select()
    .from(levelDescriptions)
    .where(eq(levelDescriptions.controlId, controlId))
    .orderBy(asc(levelDescriptions.levelValue));
}

export async function getControlRecommendation(controlId: string, targetLevel: number) {
  const [row] = await db
    .select()
    .from(recommendations)
    .where(and(eq(recommendations.controlId, controlId), eq(recommendations.targetLevel, targetLevel)));
  return row ?? null;
}

export async function getControlCitations(controlId: string) {
  return db
    .select({
      standardName: standards.name,
      rawCitation: controlStandardCitations.rawCitation,
      parsedClause: controlStandardCitations.parsedClause,
      isMandatory: controlStandardCitations.isMandatory,
    })
    .from(controlStandardCitations)
    .innerJoin(standards, eq(standards.id, controlStandardCitations.standardId))
    .where(eq(controlStandardCitations.controlId, controlId));
}

export async function getLatestClientToken(cycleId: string) {
  const [row] = await db
    .select()
    .from(clientTokens)
    .where(and(eq(clientTokens.cycleId, cycleId), isNull(clientTokens.revokedAt)))
    .orderBy(desc(clientTokens.createdAt));
  return row ?? null;
}

export async function getPreviousCycleRating(cycleId: string, controlId: string) {
  // Looks up the immediately preceding cycle's rating for this control,
  // for the reassessment delta view.
  const [cycleRow] = await db.select().from(assessmentCycles).where(eq(assessmentCycles.id, cycleId));
  if (!cycleRow) return null;
  const [previousCycle] = await db
    .select()
    .from(assessmentCycles)
    .where(
      and(
        eq(assessmentCycles.engagementFrameworkId, cycleRow.engagementFrameworkId),
        eq(assessmentCycles.cycleNumber, cycleRow.cycleNumber - 1),
      ),
    );
  if (!previousCycle) return null;

  const [row] = await db
    .select({ maturityLevel: ratings.maturityLevel, targetLevel: ratings.targetLevel })
    .from(cycleControls)
    .innerJoin(ratings, eq(ratings.cycleControlId, cycleControls.id))
    .where(and(eq(cycleControls.cycleId, previousCycle.id), eq(cycleControls.controlId, controlId)));
  return row ?? null;
}

export async function getClientTokenContext(token: string) {
  const [row] = await db
    .select({
      tokenId: clientTokens.id,
      token: clientTokens.token,
      expiresAt: clientTokens.expiresAt,
      revokedAt: clientTokens.revokedAt,
      cycleId: assessmentCycles.id,
      cycleStatus: assessmentCycles.status,
      engagementFrameworkId: assessmentCycles.engagementFrameworkId,
      frameworkId: frameworks.id,
      frameworkCode: frameworks.code,
      clientName: clients.name,
      engagementName: engagements.name,
    })
    .from(clientTokens)
    .innerJoin(assessmentCycles, eq(assessmentCycles.id, clientTokens.cycleId))
    .innerJoin(engagementFrameworks, eq(engagementFrameworks.id, assessmentCycles.engagementFrameworkId))
    .innerJoin(frameworks, eq(frameworks.id, engagementFrameworks.frameworkId))
    .innerJoin(engagements, eq(engagements.id, engagementFrameworks.engagementId))
    .innerJoin(clients, eq(clients.id, engagements.clientId))
    .where(
      and(
        eq(clientTokens.token, token),
        isNull(clientTokens.revokedAt),
        or(isNull(clientTokens.expiresAt), gt(clientTokens.expiresAt, new Date())),
      ),
    );
  return row ?? null;
}

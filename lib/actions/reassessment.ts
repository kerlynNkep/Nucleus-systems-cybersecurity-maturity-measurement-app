"use server";

import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import {
  assessmentCycles,
  clientTokens,
  controlResponses,
  cycleControls,
  cycleScopingAnswers,
  ratings,
} from "@/db/schema";
import { startReassessmentSchema } from "@/lib/schemas";
import { finalizeScoping, saveScopingAnswers } from "@/lib/actions/engagement";

/**
 * A new cycle on the same engagement, pre-filled from the previous one:
 * scoping answers, in-scope resolution, responses and ratings are all
 * copied forward as a starting point. Nothing here is locked — the
 * client/assessor update whatever's changed and re-submit/re-rate for
 * this cycle, same as the first time through.
 */
export async function startReassessment(input: unknown) {
  const parsed = startReassessmentSchema.parse(input);

  const previousCycles = await db
    .select()
    .from(assessmentCycles)
    .where(eq(assessmentCycles.engagementFrameworkId, parsed.engagementFrameworkId))
    .orderBy(desc(assessmentCycles.cycleNumber));
  const previousCycle = previousCycles[0];
  if (!previousCycle) throw new Error("No prior cycle to reassess from");

  const [newCycle] = await db
    .insert(assessmentCycles)
    .values({
      engagementId: previousCycle.engagementId,
      engagementFrameworkId: parsed.engagementFrameworkId,
      cycleNumber: previousCycle.cycleNumber + 1,
      status: "scoping",
    })
    .returning();

  // Pre-fill scoping answers.
  const previousAnswers = await db
    .select()
    .from(cycleScopingAnswers)
    .where(eq(cycleScopingAnswers.cycleId, previousCycle.id));
  await saveScopingAnswers({
    cycleId: newCycle.id,
    answers: previousAnswers.map((a) => ({
      questionId: a.scopingQuestionId,
      answer: a.answer == null ? "unanswered" : a.answer ? "yes" : "no",
      comment: a.comment ?? undefined,
    })),
  });

  // Re-resolve scope for the new cycle (in case answers changed) and issue a fresh client token.
  await finalizeScoping({ cycleId: newCycle.id });

  // Pre-fill responses and ratings from the previous cycle, matched by control.
  const previousCycleControls = await db
    .select()
    .from(cycleControls)
    .where(eq(cycleControls.cycleId, previousCycle.id));
  const newCycleControls = await db
    .select()
    .from(cycleControls)
    .where(eq(cycleControls.cycleId, newCycle.id));
  const newCycleControlByControlId = new Map(newCycleControls.map((c) => [c.controlId, c]));

  for (const prev of previousCycleControls) {
    const next = newCycleControlByControlId.get(prev.controlId);
    if (!next) continue;

    const [prevResponse] = await db
      .select()
      .from(controlResponses)
      .where(eq(controlResponses.cycleControlId, prev.id));
    if (prevResponse) {
      await db.insert(controlResponses).values({
        cycleControlId: next.id,
        currentStateNarrative: prevResponse.currentStateNarrative,
        evidenceHeldNarrative: prevResponse.evidenceHeldNarrative,
        evidenceRegisterRef: prevResponse.evidenceRegisterRef,
        status: "draft", // carried forward, but not yet re-submitted for this cycle
      });
    }

    const [prevRating] = await db.select().from(ratings).where(eq(ratings.cycleControlId, prev.id));
    if (prevRating) {
      await db.insert(ratings).values({
        cycleControlId: next.id,
        maturityLevel: prevRating.maturityLevel,
        targetLevel: prevRating.targetLevel,
      });
    }
  }

  redirect(`/cycles/${newCycle.id}`);
}

export async function issueFreshClientToken(cycleId: string) {
  const token = randomBytes(24).toString("base64url");
  const [clientToken] = await db.insert(clientTokens).values({ cycleId, token }).returning();
  return clientToken.token;
}

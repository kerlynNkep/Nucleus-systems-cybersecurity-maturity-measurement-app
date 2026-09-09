"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import {
  assessmentCycles,
  clientTokens,
  clients,
  controlScopingRules,
  controls,
  cycleControls,
  cycleScopingAnswers,
  engagementFrameworks,
  engagements,
} from "@/db/schema";
import {
  createEngagementSchema,
  finalizeScopingSchema,
  saveScopingAnswersSchema,
} from "@/lib/schemas";

export async function createEngagement(formData: FormData) {
  const parsed = createEngagementSchema.parse({
    clientName: formData.get("clientName"),
    engagementName: formData.get("engagementName"),
    assessorName: formData.get("assessorName"),
    frameworkId: formData.get("frameworkId"),
  });

  const [client] = await db.insert(clients).values({ name: parsed.clientName }).returning();
  const [engagement] = await db
    .insert(engagements)
    .values({ clientId: client.id, name: parsed.engagementName, assessorName: parsed.assessorName })
    .returning();
  const [engagementFramework] = await db
    .insert(engagementFrameworks)
    .values({ engagementId: engagement.id, frameworkId: parsed.frameworkId })
    .returning();
  const [cycle] = await db
    .insert(assessmentCycles)
    .values({ engagementId: engagement.id, engagementFrameworkId: engagementFramework.id, cycleNumber: 1, status: "scoping" })
    .returning();

  redirect(`/cycles/${cycle.id}/scoping`);
}

export async function saveScopingAnswers(input: unknown) {
  const parsed = saveScopingAnswersSchema.parse(input);

  for (const answer of parsed.answers) {
    const value = answer.answer === "unanswered" ? null : answer.answer === "yes";
    await db
      .insert(cycleScopingAnswers)
      .values({
        cycleId: parsed.cycleId,
        scopingQuestionId: answer.questionId,
        answer: value,
        comment: answer.comment || null,
        answeredAt: value == null ? null : new Date(),
      })
      .onConflictDoUpdate({
        target: [cycleScopingAnswers.cycleId, cycleScopingAnswers.scopingQuestionId],
        set: { answer: value, comment: answer.comment || null, answeredAt: value == null ? null : new Date() },
      });
  }

  revalidatePath(`/cycles/${parsed.cycleId}/scoping`);
}

/**
 * The real auto-exclusion logic the source workbook only gestured at
 * (see SHORTFALLS.md): resolves every control in this cycle's framework
 * against the scoping answers just saved, and materializes cycle_controls.
 * A control with no scoping_rules is always in scope. A control with one
 * or more rules is excluded the moment ANY of its required questions is
 * answered "No" — an unanswered question never excludes (conservative,
 * matching the source's own "if unsure, answer Yes" guidance).
 */
export async function finalizeScoping(input: unknown) {
  const parsed = finalizeScopingSchema.parse(input);

  const [cycle] = await db
    .select()
    .from(assessmentCycles)
    .where(eq(assessmentCycles.id, parsed.cycleId));
  if (!cycle) throw new Error("Cycle not found");

  const [ef] = await db
    .select()
    .from(engagementFrameworks)
    .where(eq(engagementFrameworks.id, cycle.engagementFrameworkId));

  const allControls = await db.select().from(controls).where(eq(controls.frameworkId, ef.frameworkId));
  const answers = await db
    .select()
    .from(cycleScopingAnswers)
    .where(eq(cycleScopingAnswers.cycleId, parsed.cycleId));
  const answerByQuestionId = new Map(answers.map((a) => [a.scopingQuestionId, a.answer]));

  const allRules = await db.select().from(controlScopingRules);
  const rulesByControlId = new Map<string, string[]>();
  for (const rule of allRules) {
    const list = rulesByControlId.get(rule.controlId) ?? [];
    list.push(rule.scopingQuestionId);
    rulesByControlId.set(rule.controlId, list);
  }

  for (const control of allControls) {
    const requiredQuestionIds = rulesByControlId.get(control.id) ?? [];
    const failedQuestionId = requiredQuestionIds.find(
      (qId) => answerByQuestionId.get(qId) === false,
    );
    const inScope = failedQuestionId == null;

    await db
      .insert(cycleControls)
      .values({
        cycleId: parsed.cycleId,
        controlId: control.id,
        inScope,
        exclusionReason: inScope ? null : "scoping_auto_excluded",
        excludedAt: inScope ? null : new Date(),
        excludedBy: inScope ? null : "system:scoping-resolution",
      })
      .onConflictDoUpdate({
        target: [cycleControls.cycleId, cycleControls.controlId],
        set: {
          inScope,
          exclusionReason: inScope ? null : "scoping_auto_excluded",
          excludedAt: inScope ? null : new Date(),
          excludedBy: inScope ? null : "system:scoping-resolution",
        },
      });
  }

  const token = randomBytes(24).toString("base64url");
  const [clientToken] = await db
    .insert(clientTokens)
    .values({ cycleId: parsed.cycleId, token })
    .returning();

  await db.update(assessmentCycles).set({ status: "questionnaire" }).where(eq(assessmentCycles.id, parsed.cycleId));

  revalidatePath(`/cycles/${parsed.cycleId}`);
  return { token: clientToken.token };
}

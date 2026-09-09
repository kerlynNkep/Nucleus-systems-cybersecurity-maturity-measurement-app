"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { assessmentCycles, controlResponses, cycleControls, responseAmendments } from "@/db/schema";
import {
  amendResponseSchema,
  controlResponseDraftSchema,
  submitQuestionnaireSchema,
} from "@/lib/schemas";
import { getClientTokenContext } from "@/lib/queries";

/** Partial saves: upsert a draft response for one control at a time. */
export async function saveControlResponseDraft(input: unknown) {
  const parsed = controlResponseDraftSchema.parse(input);

  await db
    .insert(controlResponses)
    .values({
      cycleControlId: parsed.cycleControlId,
      currentStateNarrative: parsed.currentStateNarrative || null,
      evidenceHeldNarrative: parsed.evidenceHeldNarrative || null,
      evidenceRegisterRef: parsed.evidenceRegisterRef || null,
      status: "draft",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: controlResponses.cycleControlId,
      set: {
        currentStateNarrative: parsed.currentStateNarrative || null,
        evidenceHeldNarrative: parsed.evidenceHeldNarrative || null,
        evidenceRegisterRef: parsed.evidenceRegisterRef || null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Submit and lock: every in-scope control's response becomes immutable.
 * Any later change must go through recordAmendment, never a direct edit.
 */
export async function submitAndLockQuestionnaire(input: unknown) {
  const parsed = submitQuestionnaireSchema.parse(input);

  const tokenContext = await getClientTokenContext(parsed.token);
  if (!tokenContext || tokenContext.cycleId !== parsed.cycleId) {
    throw new Error("Invalid or expired client link");
  }

  const inScopeControls = await db
    .select({ id: cycleControls.id })
    .from(cycleControls)
    .where(eq(cycleControls.cycleId, parsed.cycleId));

  const now = new Date();
  for (const { id } of inScopeControls) {
    await db
      .insert(controlResponses)
      .values({
        cycleControlId: id,
        status: "submitted",
        submittedBy: parsed.submittedBy,
        submittedAt: now,
      })
      .onConflictDoUpdate({
        target: controlResponses.cycleControlId,
        set: { status: "submitted", submittedBy: parsed.submittedBy, submittedAt: now, updatedAt: now },
      });
  }

  await db
    .update(assessmentCycles)
    .set({ status: "validation" })
    .where(eq(assessmentCycles.id, parsed.cycleId));

  revalidatePath(`/client/${parsed.token}`);
}

/** Post-lock changes are amendments: rationale + author, audit trail. */
export async function recordAmendment(input: unknown) {
  const parsed = amendResponseSchema.parse(input);

  const [existing] = await db
    .select()
    .from(controlResponses)
    .where(eq(controlResponses.id, parsed.controlResponseId));
  if (!existing) throw new Error("Response not found");

  const previousValues = {
    currentStateNarrative: existing.currentStateNarrative,
    evidenceHeldNarrative: existing.evidenceHeldNarrative,
    evidenceRegisterRef: existing.evidenceRegisterRef,
  };
  const newValues = {
    currentStateNarrative: parsed.currentStateNarrative ?? existing.currentStateNarrative,
    evidenceHeldNarrative: parsed.evidenceHeldNarrative ?? existing.evidenceHeldNarrative,
    evidenceRegisterRef: parsed.evidenceRegisterRef ?? existing.evidenceRegisterRef,
  };

  await db.insert(responseAmendments).values({
    controlResponseId: parsed.controlResponseId,
    rationale: parsed.rationale,
    author: parsed.author,
    previousValues,
    newValues,
  });

  await db
    .update(controlResponses)
    .set({ ...newValues, updatedAt: new Date() })
    .where(eq(controlResponses.id, parsed.controlResponseId));

  revalidatePath("/", "layout");
}

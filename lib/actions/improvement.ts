"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { registerStateTransitions, remediationItems } from "@/db/schema";
import { lifecycleTransitionSchema, remediationUpdateSchema } from "@/lib/schemas";

export async function updateRemediationItem(input: unknown) {
  const parsed = remediationUpdateSchema.parse(input);
  const { remediationItemId, ...fields } = parsed;

  await db
    .update(remediationItems)
    .set({
      owner: fields.owner,
      effortEstimate: fields.effortEstimate,
      targetQuarter: fields.targetQuarter,
      status: fields.status,
      costInternal: fields.costInternal != null ? String(fields.costInternal) : undefined,
      costExternalOnceOff: fields.costExternalOnceOff != null ? String(fields.costExternalOnceOff) : undefined,
      costExternalRecurring: fields.costExternalRecurring != null ? String(fields.costExternalRecurring) : undefined,
      costTooling: fields.costTooling != null ? String(fields.costTooling) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(remediationItems.id, remediationItemId));

  revalidatePath("/", "layout");
}

type LifecycleState =
  | "assessed"
  | "remediation_planned"
  | "deferred"
  | "accepted"
  | "registered"
  | "closed";

/**
 * assessed -> remediation_planned -> deferred | accepted -> registered -> closed
 *
 * Deferring or accepting a gap immediately and automatically puts it on
 * the register — that's the whole point of the two triggers, so there is
 * no separate manual "now register it" step for an assessor to forget.
 * Both waypoints are still recorded in the audit trail.
 */
const LEGAL_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  assessed: ["remediation_planned"],
  remediation_planned: ["deferred", "accepted", "closed"],
  deferred: ["remediation_planned", "registered", "closed"],
  accepted: ["remediation_planned", "registered", "closed"],
  registered: ["closed"],
  closed: [],
};

export async function transitionRemediationLifecycle(input: unknown) {
  const parsed = lifecycleTransitionSchema.parse(input);

  const [item] = await db
    .select()
    .from(remediationItems)
    .where(eq(remediationItems.id, parsed.remediationItemId));
  if (!item) throw new Error("Remediation item not found");

  const fromState = item.lifecycleState as LifecycleState;
  const allowed = LEGAL_TRANSITIONS[fromState] ?? [];
  if (!allowed.includes(parsed.toState)) {
    throw new Error(`Cannot move a "${fromState}" item to "${parsed.toState}"`);
  }

  const isDecisionTransition = parsed.toState === "deferred" || parsed.toState === "accepted";
  if (isDecisionTransition && (!parsed.decisionMaker || !parsed.rationale)) {
    throw new Error("Deferring or accepting a gap requires a decision-maker and a rationale");
  }

  await db.insert(registerStateTransitions).values({
    remediationItemId: parsed.remediationItemId,
    fromState,
    toState: parsed.toState,
    actor: parsed.actor,
    rationale: parsed.rationale || null,
  });

  const updates: Partial<typeof remediationItems.$inferInsert> = {
    lifecycleState: parsed.toState,
    updatedAt: new Date(),
  };
  if (parsed.toState === "deferred" || parsed.toState === "accepted") {
    updates.decision = parsed.toState;
    updates.decisionMaker = parsed.decisionMaker;
    updates.decisionRationale = parsed.rationale;
    updates.reviewDate = parsed.reviewDate ? new Date(parsed.reviewDate) : null;
  }
  if (parsed.toState === "closed") {
    updates.decision = null;
  }

  await db.update(remediationItems).set(updates).where(eq(remediationItems.id, parsed.remediationItemId));

  // Auto-cascade: reaching the decision IS what puts it on the register.
  if (isDecisionTransition) {
    await db.insert(registerStateTransitions).values({
      remediationItemId: parsed.remediationItemId,
      fromState: parsed.toState,
      toState: "registered",
      actor: parsed.actor,
      rationale: `Automatically registered: ${parsed.toState} decision recorded.`,
    });
    await db
      .update(remediationItems)
      .set({ lifecycleState: "registered", updatedAt: new Date() })
      .where(eq(remediationItems.id, parsed.remediationItemId));
  }

  revalidatePath("/", "layout");
}

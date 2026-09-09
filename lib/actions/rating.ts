"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { ratings, remediationItems } from "@/db/schema";
import { ratingSchema } from "@/lib/schemas";
import { deriveGap } from "@/lib/scoring";

/**
 * Score, gap, level description and recommendation are never hand
 * entered — only maturityLevel/targetLevel are stored here. Everything
 * else is derived at read time (lib/scoring.ts, lib/queries.ts). The one
 * side effect: a positive gap creates or updates a remediation_items row
 * in the 'assessed' state, mirroring "each gap becomes a remediation
 * item" — improvement-plan/register work then proceeds from there.
 */
export async function saveRating(input: unknown) {
  const parsed = ratingSchema.parse(input);

  await db
    .insert(ratings)
    .values({
      cycleControlId: parsed.cycleControlId,
      maturityLevel: parsed.maturityLevel,
      targetLevel: parsed.targetLevel,
      ratedBy: parsed.ratedBy,
      ratedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: ratings.cycleControlId,
      set: {
        maturityLevel: parsed.maturityLevel,
        targetLevel: parsed.targetLevel,
        ratedBy: parsed.ratedBy,
        ratedAt: new Date(),
      },
    });

  const gap = deriveGap(parsed.maturityLevel, parsed.targetLevel);

  const [existingRemediation] = await db
    .select()
    .from(remediationItems)
    .where(eq(remediationItems.cycleControlId, parsed.cycleControlId));

  if (gap != null && gap > 0) {
    if (!existingRemediation) {
      await db.insert(remediationItems).values({
        cycleControlId: parsed.cycleControlId,
        lifecycleState: "assessed",
      });
    }
    // If it already exists (in any state), leave it — the gap amount is
    // derived live from ratings at read time, never stored, so there's
    // nothing to update here.
  } else if (existingRemediation && existingRemediation.lifecycleState === "assessed") {
    // The gap closed before anyone acted on it (still in the initial
    // 'assessed' state) — remove the now-pointless remediation item.
    // Once it's been planned, deferred, accepted, registered or closed,
    // it's a decision record and must not disappear just because a
    // rating changed.
    await db.delete(remediationItems).where(eq(remediationItems.id, existingRemediation.id));
  }

  revalidatePath("/", "layout");
}

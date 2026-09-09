"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { assessorReviews } from "@/db/schema";
import { reviewResponseSchema } from "@/lib/schemas";

export async function reviewResponse(input: unknown) {
  const parsed = reviewResponseSchema.parse(input);

  await db
    .insert(assessorReviews)
    .values({
      cycleControlId: parsed.cycleControlId,
      decision: parsed.decision,
      reviewer: parsed.reviewer,
      notes: parsed.notes || null,
      reviewedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: assessorReviews.cycleControlId,
      set: { decision: parsed.decision, reviewer: parsed.reviewer, notes: parsed.notes || null, reviewedAt: new Date() },
    });

  revalidatePath("/", "layout");
}

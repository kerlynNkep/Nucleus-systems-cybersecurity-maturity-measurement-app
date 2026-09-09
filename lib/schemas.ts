import { z } from "zod";

export const createEngagementSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  engagementName: z.string().min(1, "Engagement name is required"),
  assessorName: z.string().min(1, "Assessor name is required"),
  frameworkId: z.string().uuid(),
});

export const scopingAnswerEntrySchema = z.object({
  questionId: z.string().uuid(),
  answer: z.enum(["yes", "no", "unanswered"]),
  comment: z.string().optional(),
});

export const saveScopingAnswersSchema = z.object({
  cycleId: z.string().uuid(),
  answers: z.array(scopingAnswerEntrySchema),
});

export const finalizeScopingSchema = z.object({
  cycleId: z.string().uuid(),
});

export const controlResponseDraftSchema = z.object({
  cycleControlId: z.string().uuid(),
  currentStateNarrative: z.string().optional(),
  evidenceHeldNarrative: z.string().optional(),
  evidenceRegisterRef: z.string().optional(),
});

export const submitQuestionnaireSchema = z.object({
  cycleId: z.string().uuid(),
  token: z.string().min(1),
  submittedBy: z.string().min(1, "Your name is required to submit"),
});

export const amendResponseSchema = z.object({
  controlResponseId: z.string().uuid(),
  currentStateNarrative: z.string().optional(),
  evidenceHeldNarrative: z.string().optional(),
  evidenceRegisterRef: z.string().optional(),
  rationale: z.string().min(1, "A rationale is required to amend a locked response"),
  author: z.string().min(1),
});

export const reviewResponseSchema = z.object({
  cycleControlId: z.string().uuid(),
  decision: z.enum(["accepted", "flagged_for_interview"]),
  reviewer: z.string().min(1),
  notes: z.string().optional(),
});

export const ratingSchema = z.object({
  cycleControlId: z.string().uuid(),
  maturityLevel: z.number().int().min(1).max(5).nullable(),
  targetLevel: z.number().int().min(1).max(5).nullable(),
  ratedBy: z.string().min(1),
});

export const remediationUpdateSchema = z.object({
  remediationItemId: z.string().uuid(),
  owner: z.string().optional(),
  effortEstimate: z.string().optional(),
  targetQuarter: z.string().optional(),
  status: z.enum(["not_started", "in_progress", "complete"]).optional(),
  costInternal: z.coerce.number().nonnegative().optional().nullable(),
  costExternalOnceOff: z.coerce.number().nonnegative().optional().nullable(),
  costExternalRecurring: z.coerce.number().nonnegative().optional().nullable(),
  costTooling: z.coerce.number().nonnegative().optional().nullable(),
});

export const lifecycleTransitionSchema = z.object({
  remediationItemId: z.string().uuid(),
  toState: z.enum([
    "assessed",
    "remediation_planned",
    "deferred",
    "accepted",
    "registered",
    "closed",
  ]),
  actor: z.string().min(1, "Actor name is required"),
  rationale: z.string().optional(),
  decisionMaker: z.string().optional(),
  reviewDate: z.string().optional(),
});

export const startReassessmentSchema = z.object({
  engagementFrameworkId: z.string().uuid(),
});

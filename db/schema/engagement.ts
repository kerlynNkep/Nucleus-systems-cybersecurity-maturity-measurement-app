import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { controls, frameworks, scopingQuestions } from "./framework";
import {
  cycleStatusEnum,
  engagementStatusEnum,
  evidenceStatusEnum,
  evidenceTierEnum,
  exclusionReasonEnum,
  responseStatusEnum,
  reviewDecisionEnum,
} from "./enums";

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const engagements = pgTable("engagements", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Auth is a stub for this prototype: an assessor "session" is just a
  // free-text name, not a real account.
  assessorName: text("assessor_name").notNull(),
  status: engagementStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** An engagement can run more than one framework at once. */
export const engagementFrameworks = pgTable(
  "engagement_frameworks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    frameworkId: uuid("framework_id")
      .notNull()
      .references(() => frameworks.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.engagementId, t.frameworkId)],
);

/**
 * Every questionnaire response, rating and scoping answer belongs to a
 * cycle, so a reassessment is a new cycle on the same engagement that
 * can be pre-filled from the previous one and diffed against it.
 */
export const assessmentCycles = pgTable(
  "assessment_cycles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    engagementFrameworkId: uuid("engagement_framework_id")
      .notNull()
      .references(() => engagementFrameworks.id, { onDelete: "cascade" }),
    cycleNumber: integer("cycle_number").notNull(),
    status: cycleStatusEnum("status").notNull().default("scoping"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.engagementFrameworkId, t.cycleNumber)],
);

/** Tokenised, account-less client link — scoped to one cycle. */
export const clientTokens = pgTable("client_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  cycleId: uuid("cycle_id")
    .notNull()
    .references(() => assessmentCycles.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cycleScopingAnswers = pgTable(
  "cycle_scoping_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => assessmentCycles.id, { onDelete: "cascade" }),
    scopingQuestionId: uuid("scoping_question_id")
      .notNull()
      .references(() => scopingQuestions.id, { onDelete: "cascade" }),
    answer: boolean("answer"), // null = unanswered
    comment: text("comment"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.cycleId, t.scopingQuestionId)],
);

/**
 * The materialized in-scope/excluded resolution per control per cycle —
 * this is where the real auto-exclusion logic lives. The source
 * workbook only *displays* an informational count; nothing in it
 * actually computes this, despite formulas that check for a status they
 * never produce (see SHORTFALLS.md). This table is where we actually do
 * what the workbook only gestured at.
 */
export const cycleControls = pgTable(
  "cycle_controls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => assessmentCycles.id, { onDelete: "cascade" }),
    controlId: uuid("control_id")
      .notNull()
      .references(() => controls.id, { onDelete: "cascade" }),
    inScope: boolean("in_scope").notNull().default(true),
    exclusionReason: exclusionReasonEnum("exclusion_reason"),
    excludedAt: timestamp("excluded_at", { withTimezone: true }),
    excludedBy: text("excluded_by"),
  },
  (t) => [unique().on(t.cycleId, t.controlId)],
);

export const controlResponses = pgTable("control_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  cycleControlId: uuid("cycle_control_id")
    .notNull()
    .unique()
    .references(() => cycleControls.id, { onDelete: "cascade" }),
  currentStateNarrative: text("current_state_narrative"),
  evidenceHeldNarrative: text("evidence_held_narrative"),
  evidenceRegisterRef: text("evidence_register_ref"),
  status: responseStatusEnum("status").notNull().default("draft"),
  submittedBy: text("submitted_by"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Any change to a submitted (locked) response is an amendment, never an
 * in-place edit — carries a rationale and an author, per the brief.
 */
export const responseAmendments = pgTable("response_amendments", {
  id: uuid("id").defaultRandom().primaryKey(),
  controlResponseId: uuid("control_response_id")
    .notNull()
    .references(() => controlResponses.id, { onDelete: "cascade" }),
  rationale: text("rationale").notNull(),
  author: text("author").notNull(),
  previousValues: jsonb("previous_values").notNull(),
  newValues: jsonb("new_values").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const assessorReviews = pgTable("assessor_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  cycleControlId: uuid("cycle_control_id")
    .notNull()
    .unique()
    .references(() => cycleControls.id, { onDelete: "cascade" }),
  decision: reviewDecisionEnum("decision").notNull(),
  reviewer: text("reviewer").notNull(),
  notes: text("notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Score, gap, level description and recommendation are never stored here
 * — they're derived server-side from maturityLevel/targetLevel by the
 * scoring engine, exactly per the brief ("never hand-entered").
 */
export const ratings = pgTable("ratings", {
  id: uuid("id").defaultRandom().primaryKey(),
  cycleControlId: uuid("cycle_control_id")
    .notNull()
    .unique()
    .references(() => cycleControls.id, { onDelete: "cascade" }),
  maturityLevel: integer("maturity_level"),
  targetLevel: integer("target_level"),
  ratedBy: text("rated_by"),
  ratedAt: timestamp("rated_at", { withTimezone: true }),
});

/**
 * One-to-many with controls (a real improvement over the source, which
 * only supports one evidence slot per control — see SHORTFALLS.md).
 * Real file upload is out of scope for this prototype: documentName is
 * metadata only, with no artefact stored.
 */
export const evidenceItems = pgTable("evidence_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  cycleControlId: uuid("cycle_control_id")
    .notNull()
    .references(() => cycleControls.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  documentName: text("document_name"),
  tier: evidenceTierEnum("tier"),
  collectionDate: timestamp("collection_date", { mode: "date" }),
  expiryDate: timestamp("expiry_date", { mode: "date" }),
  status: evidenceStatusEnum("status").notNull().default("requested"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

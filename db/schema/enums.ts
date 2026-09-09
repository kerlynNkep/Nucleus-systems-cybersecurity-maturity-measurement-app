import { pgEnum } from "drizzle-orm/pg-core";

/**
 * These enums are genuinely fixed by our own process, not by any single
 * framework's content — unlike maturity levels, domain weights, or scoping
 * questions, which are framework data and live in tables instead.
 */

export const engagementStatusEnum = pgEnum("engagement_status", [
  "active",
  "closed",
]);

export const cycleStatusEnum = pgEnum("cycle_status", [
  "scoping",
  "questionnaire",
  "validation",
  "rating",
  "complete",
]);

export const responseStatusEnum = pgEnum("response_status", [
  "draft",
  "submitted",
]);

export const reviewDecisionEnum = pgEnum("review_decision", [
  "accepted",
  "flagged_for_interview",
]);

export const evidenceTierEnum = pgEnum("evidence_tier", [
  "tier_1_automated",
  "tier_2_documentary",
  "tier_3_interview",
  "tier_4_attestation",
]);

export const evidenceStatusEnum = pgEnum("evidence_status", [
  "current",
  "expiring",
  "expired",
  "requested",
  "not_applicable",
]);

export const remediationStatusEnum = pgEnum("remediation_status", [
  "not_started",
  "in_progress",
  "complete",
]);

/**
 * The gap-to-register lifecycle. This is the state machine — the register
 * is a *view* over remediation_items filtered to `registered`, never a
 * separate table with its own inputs.
 */
export const lifecycleStateEnum = pgEnum("lifecycle_state", [
  "assessed",
  "remediation_planned",
  "deferred",
  "accepted",
  "registered",
  "closed",
]);

export const registerDecisionEnum = pgEnum("register_decision", [
  "deferred",
  "accepted",
]);

export const exclusionReasonEnum = pgEnum("exclusion_reason", [
  "scoping_auto_excluded",
  "assessor_manual_exclude",
]);

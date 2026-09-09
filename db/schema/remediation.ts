import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { cycleControls } from "./engagement";
import {
  lifecycleStateEnum,
  registerDecisionEnum,
  remediationStatusEnum,
} from "./enums";

/**
 * One object, one lifecycle:
 *   assessed -> remediation_planned -> deferred|accepted -> registered -> closed
 *
 * The register is NOT a separate table. It's a view over rows here
 * filtered to lifecycleState = 'registered' (see lib/register.ts), so
 * there is no free-text field anywhere in this table that isn't derived
 * from a control gap.
 */
export const remediationItems = pgTable("remediation_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  cycleControlId: uuid("cycle_control_id")
    .notNull()
    .unique()
    .references(() => cycleControls.id, { onDelete: "cascade" }),

  // Improvement-plan fields (mirrors the Roadmap sheet)
  owner: text("owner"),
  effortEstimate: text("effort_estimate"), // e.g. "High (1-3 months)" — source uses descriptive bands, not a clean enum
  targetQuarter: text("target_quarter"), // e.g. "Q2 2027"
  status: remediationStatusEnum("status").notNull().default("not_started"),
  costInternal: numeric("cost_internal", { precision: 12, scale: 2 }),
  costExternalOnceOff: numeric("cost_external_once_off", {
    precision: 12,
    scale: 2,
  }),
  costExternalRecurring: numeric("cost_external_recurring", {
    precision: 12,
    scale: 2,
  }),
  costTooling: numeric("cost_tooling", { precision: 12, scale: 2 }),

  // Register-promotion fields. decision/decisionMaker/reviewDate are set
  // when the lifecycle moves into deferred or accepted.
  decision: registerDecisionEnum("decision"),
  decisionMaker: text("decision_maker"),
  decisionRationale: text("decision_rationale"),
  reviewDate: timestamp("review_date", { mode: "date" }),

  lifecycleState: lifecycleStateEnum("lifecycle_state")
    .notNull()
    .default("assessed"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Audit trail of lifecycle-state changes — who, when, why. */
export const registerStateTransitions = pgTable("register_state_transitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  remediationItemId: uuid("remediation_item_id")
    .notNull()
    .references(() => remediationItems.id, { onDelete: "cascade" }),
  fromState: lifecycleStateEnum("from_state"),
  toState: lifecycleStateEnum("to_state").notNull(),
  actor: text("actor").notNull(),
  rationale: text("rationale"),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A framework is a whole assessment methodology (NS-CMMF, NS-PQCF, ...).
 * Everything that varies between frameworks — scale, weights, question
 * sets, the name of the thing being assessed — is a column or a row here,
 * never a constant in application code.
 */
export const frameworks = pgTable("frameworks", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // e.g. "NS-CMMF"
  name: text("name").notNull(),
  version: text("version").notNull(), // e.g. "v1.0"
  // NS-CMMF calls its unit a "control"; NS-PQCF might call it a "readiness
  // criterion". UI copy reads this instead of a hardcoded noun.
  assessmentUnitSingular: text("assessment_unit_singular")
    .notNull()
    .default("Control"),
  assessmentUnitPlural: text("assessment_unit_plural")
    .notNull()
    .default("Controls"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * The maturity scale is a row set, not a five-valued enum — a framework
 * with a 3-level or a binary readiness scale reuses this table unchanged.
 */
export const maturityScales = pgTable(
  "maturity_scales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    frameworkId: uuid("framework_id")
      .notNull()
      .references(() => frameworks.id, { onDelete: "cascade" }),
    levelValue: integer("level_value").notNull(), // e.g. 1..5
    label: text("label").notNull(), // e.g. "L1 — Initial"
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [unique().on(t.frameworkId, t.levelValue)],
);

/**
 * Domains group assessment units within a framework and carry the
 * rollup weight. Weights are NOT assumed to sum to 1 — see the scoring
 * engine, which normalizes by dividing by the sum of weights actually in
 * play, exactly like the source workbook's Dashboard formulas do.
 */
export const domains = pgTable(
  "domains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    frameworkId: uuid("framework_id")
      .notNull()
      .references(() => frameworks.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // e.g. "GV"
    name: text("name").notNull(),
    weight: numeric("weight", { precision: 6, scale: 4 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [unique().on(t.frameworkId, t.code)],
);

/**
 * The assessment unit itself. Named "controls" because that's what
 * NS-CMMF's are, but the table is generic — a readiness criterion or an
 * architecture pattern from another framework is still a row here.
 */
export const controls = pgTable(
  "controls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    frameworkId: uuid("framework_id")
      .notNull()
      .references(() => frameworks.id, { onDelete: "cascade" }),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    globalNumber: integer("global_number").notNull(), // 1..188 for NS-CMMF
    code: text("code").notNull(), // e.g. "GV-001"
    category: text("category").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    riskImpactNarrative: text("risk_impact_narrative").notNull(),
    // Drives the FOUNDATIONAL_ABSENCE register trigger (control flagged
    // foundational in its framework, rated L1).
    isFoundational: boolean("is_foundational").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    unique().on(t.frameworkId, t.globalNumber),
    unique().on(t.frameworkId, t.code),
  ],
);

/**
 * External standard families (NIST CSF, ISO 27001, DORA, ...). Citation
 * strings in the source data don't cleanly separate a standard name from
 * its clause — see control_standard_citations.rawCitation.
 */
export const standards = pgTable("standards", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
});

/**
 * The control <-> standard <-> clause many-to-many, replacing the
 * pipe-delimited string in the source workbook's "Frameworks &
 * Regulations" column. rawCitation preserves the original text because
 * clause parsing is not reliable across all the formats seen in the data
 * (see SHORTFALLS.md) — parsedClause is best-effort, nullable.
 */
export const controlStandardCitations = pgTable("control_standard_citations", {
  id: uuid("id").defaultRandom().primaryKey(),
  controlId: uuid("control_id")
    .notNull()
    .references(() => controls.id, { onDelete: "cascade" }),
  standardId: uuid("standard_id")
    .notNull()
    .references(() => standards.id, { onDelete: "cascade" }),
  rawCitation: text("raw_citation").notNull(), // verbatim, e.g. "NIS2 Art.20"
  parsedClause: text("parsed_clause"),
  // Whether this citation represents a compliance mandate this control
  // must meet — feeds the MANDATE_SHORTFALL register trigger. All NS-CMMF
  // citations are mandates today; the field exists for frameworks where a
  // citation might be advisory rather than mandatory.
  isMandatory: boolean("is_mandatory").notNull().default(true),
});

/**
 * The scoping question set belongs to the framework — NS-CMMF's 23
 * questions are not universal.
 */
export const scopingQuestions = pgTable(
  "scoping_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    frameworkId: uuid("framework_id")
      .notNull()
      .references(() => frameworks.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // e.g. "Q1"
    category: text("category").notNull(),
    questionText: text("question_text").notNull(),
    helpText: text("help_text"),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [unique().on(t.frameworkId, t.code)],
);

/**
 * Presence of a row means "this control requires a Yes answer to this
 * question to stay in scope" — mirrors the _SCOPE matrix (sparse: only
 * ~1/3 of NS-CMMF's controls carry any scoping dependency at all).
 */
export const controlScopingRules = pgTable(
  "control_scoping_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    controlId: uuid("control_id")
      .notNull()
      .references(() => controls.id, { onDelete: "cascade" }),
    scopingQuestionId: uuid("scoping_question_id")
      .notNull()
      .references(() => scopingQuestions.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.controlId, t.scopingQuestionId)],
);

/**
 * Per-control, per-level description (the resolved text, not a template).
 * NS-CMMF's _DV content happens to be 100% generated from 5 fixed
 * templates with the control name substituted in (verified across all
 * 940 cells) — but we store the resolved text as data, not a template
 * mechanism, because we can't assume every framework will be this
 * uniform. See SHORTFALLS.md.
 */
export const levelDescriptions = pgTable(
  "level_descriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    controlId: uuid("control_id")
      .notNull()
      .references(() => controls.id, { onDelete: "cascade" }),
    levelValue: integer("level_value").notNull(),
    description: text("description").notNull(),
  },
  (t) => [unique().on(t.controlId, t.levelValue)],
);

/**
 * Per-control, per-target-level recommendation text (resolved, same
 * reasoning as level_descriptions — NS-CMMF's _REC is also 100%
 * templated by target level, but we don't bake that assumption in).
 */
export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    controlId: uuid("control_id")
      .notNull()
      .references(() => controls.id, { onDelete: "cascade" }),
    targetLevel: integer("target_level").notNull(),
    text: text("text").notNull(),
  },
  (t) => [unique().on(t.controlId, t.targetLevel)],
);

/**
 * Cross-framework control mapping — e.g. NS-CMMF's "Prompt Injection
 * Prevention" control overlapping NS-AISCA and NS-AIGF controls that
 * don't exist yet. Empty until a second framework is loaded, but the
 * shape has to exist now: a client who buys NS-CMMF then NS-AIGF must
 * not have to answer the same control twice.
 */
export const crossFrameworkControlLinks = pgTable(
  "cross_framework_control_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    controlIdA: uuid("control_id_a")
      .notNull()
      .references(() => controls.id, { onDelete: "cascade" }),
    controlIdB: uuid("control_id_b")
      .notNull()
      .references(() => controls.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type").notNull(), // 'equivalent' | 'overlaps' | 'supersedes'
    note: text("note"),
  },
  (t) => [unique().on(t.controlIdA, t.controlIdB, t.relationshipType)],
);

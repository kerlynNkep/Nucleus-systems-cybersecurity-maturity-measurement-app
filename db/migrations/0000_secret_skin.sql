CREATE TYPE "public"."cycle_status" AS ENUM('scoping', 'questionnaire', 'validation', 'rating', 'complete');--> statement-breakpoint
CREATE TYPE "public"."engagement_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('current', 'expiring', 'expired', 'requested', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."evidence_tier" AS ENUM('tier_1_automated', 'tier_2_documentary', 'tier_3_interview', 'tier_4_attestation');--> statement-breakpoint
CREATE TYPE "public"."exclusion_reason" AS ENUM('scoping_auto_excluded', 'assessor_manual_exclude');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_state" AS ENUM('assessed', 'remediation_planned', 'deferred', 'accepted', 'registered', 'closed');--> statement-breakpoint
CREATE TYPE "public"."register_decision" AS ENUM('deferred', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."remediation_status" AS ENUM('not_started', 'in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."response_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('accepted', 'flagged_for_interview');--> statement-breakpoint
CREATE TABLE "control_scoping_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_id" uuid NOT NULL,
	"scoping_question_id" uuid NOT NULL,
	CONSTRAINT "control_scoping_rules_control_id_scoping_question_id_unique" UNIQUE("control_id","scoping_question_id")
);
--> statement-breakpoint
CREATE TABLE "control_standard_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_id" uuid NOT NULL,
	"standard_id" uuid NOT NULL,
	"raw_citation" text NOT NULL,
	"parsed_clause" text,
	"is_mandatory" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"global_number" integer NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"risk_impact_narrative" text NOT NULL,
	"is_foundational" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "controls_framework_id_global_number_unique" UNIQUE("framework_id","global_number"),
	CONSTRAINT "controls_framework_id_code_unique" UNIQUE("framework_id","code")
);
--> statement-breakpoint
CREATE TABLE "cross_framework_control_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_id_a" uuid NOT NULL,
	"control_id_b" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"note" text,
	CONSTRAINT "cross_framework_control_links_control_id_a_control_id_b_relationship_type_unique" UNIQUE("control_id_a","control_id_b","relationship_type")
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"weight" numeric(6, 4) NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "domains_framework_id_code_unique" UNIQUE("framework_id","code")
);
--> statement-breakpoint
CREATE TABLE "frameworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"assessment_unit_singular" text DEFAULT 'Control' NOT NULL,
	"assessment_unit_plural" text DEFAULT 'Controls' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "frameworks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "level_descriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_id" uuid NOT NULL,
	"level_value" integer NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "level_descriptions_control_id_level_value_unique" UNIQUE("control_id","level_value")
);
--> statement-breakpoint
CREATE TABLE "maturity_scales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" uuid NOT NULL,
	"level_value" integer NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "maturity_scales_framework_id_level_value_unique" UNIQUE("framework_id","level_value")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_id" uuid NOT NULL,
	"target_level" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "recommendations_control_id_target_level_unique" UNIQUE("control_id","target_level")
);
--> statement-breakpoint
CREATE TABLE "scoping_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" uuid NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"question_text" text NOT NULL,
	"help_text" text,
	"sort_order" integer NOT NULL,
	CONSTRAINT "scoping_questions_framework_id_code_unique" UNIQUE("framework_id","code")
);
--> statement-breakpoint
CREATE TABLE "standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "standards_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "assessment_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"engagement_framework_id" uuid NOT NULL,
	"cycle_number" integer NOT NULL,
	"status" "cycle_status" DEFAULT 'scoping' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "assessment_cycles_engagement_framework_id_cycle_number_unique" UNIQUE("engagement_framework_id","cycle_number")
);
--> statement-breakpoint
CREATE TABLE "assessor_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_control_id" uuid NOT NULL,
	"decision" "review_decision" NOT NULL,
	"reviewer" text NOT NULL,
	"notes" text,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessor_reviews_cycle_control_id_unique" UNIQUE("cycle_control_id")
);
--> statement-breakpoint
CREATE TABLE "client_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"primary_contact_name" text,
	"primary_contact_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_control_id" uuid NOT NULL,
	"current_state_narrative" text,
	"evidence_held_narrative" text,
	"evidence_register_ref" text,
	"status" "response_status" DEFAULT 'draft' NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "control_responses_cycle_control_id_unique" UNIQUE("cycle_control_id")
);
--> statement-breakpoint
CREATE TABLE "cycle_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"in_scope" boolean DEFAULT true NOT NULL,
	"exclusion_reason" "exclusion_reason",
	"excluded_at" timestamp with time zone,
	"excluded_by" text,
	CONSTRAINT "cycle_controls_cycle_id_control_id_unique" UNIQUE("cycle_id","control_id")
);
--> statement-breakpoint
CREATE TABLE "cycle_scoping_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"scoping_question_id" uuid NOT NULL,
	"answer" boolean,
	"comment" text,
	"answered_at" timestamp with time zone,
	CONSTRAINT "cycle_scoping_answers_cycle_id_scoping_question_id_unique" UNIQUE("cycle_id","scoping_question_id")
);
--> statement-breakpoint
CREATE TABLE "engagement_frameworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"framework_id" uuid NOT NULL,
	CONSTRAINT "engagement_frameworks_engagement_id_framework_id_unique" UNIQUE("engagement_id","framework_id")
);
--> statement-breakpoint
CREATE TABLE "engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"assessor_name" text NOT NULL,
	"status" "engagement_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_control_id" uuid NOT NULL,
	"description" text NOT NULL,
	"document_name" text,
	"tier" "evidence_tier",
	"collection_date" timestamp,
	"expiry_date" timestamp,
	"status" "evidence_status" DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_control_id" uuid NOT NULL,
	"maturity_level" integer,
	"target_level" integer,
	"rated_by" text,
	"rated_at" timestamp with time zone,
	CONSTRAINT "ratings_cycle_control_id_unique" UNIQUE("cycle_control_id")
);
--> statement-breakpoint
CREATE TABLE "response_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_response_id" uuid NOT NULL,
	"rationale" text NOT NULL,
	"author" text NOT NULL,
	"previous_values" jsonb NOT NULL,
	"new_values" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "register_state_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remediation_item_id" uuid NOT NULL,
	"from_state" "lifecycle_state",
	"to_state" "lifecycle_state" NOT NULL,
	"actor" text NOT NULL,
	"rationale" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remediation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_control_id" uuid NOT NULL,
	"owner" text,
	"effort_estimate" text,
	"target_quarter" text,
	"status" "remediation_status" DEFAULT 'not_started' NOT NULL,
	"cost_internal" numeric(12, 2),
	"cost_external_once_off" numeric(12, 2),
	"cost_external_recurring" numeric(12, 2),
	"cost_tooling" numeric(12, 2),
	"decision" "register_decision",
	"decision_maker" text,
	"decision_rationale" text,
	"review_date" timestamp,
	"lifecycle_state" "lifecycle_state" DEFAULT 'assessed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remediation_items_cycle_control_id_unique" UNIQUE("cycle_control_id")
);
--> statement-breakpoint
ALTER TABLE "control_scoping_rules" ADD CONSTRAINT "control_scoping_rules_control_id_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_scoping_rules" ADD CONSTRAINT "control_scoping_rules_scoping_question_id_scoping_questions_id_fk" FOREIGN KEY ("scoping_question_id") REFERENCES "public"."scoping_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_standard_citations" ADD CONSTRAINT "control_standard_citations_control_id_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_standard_citations" ADD CONSTRAINT "control_standard_citations_standard_id_standards_id_fk" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controls" ADD CONSTRAINT "controls_framework_id_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controls" ADD CONSTRAINT "controls_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_framework_control_links" ADD CONSTRAINT "cross_framework_control_links_control_id_a_controls_id_fk" FOREIGN KEY ("control_id_a") REFERENCES "public"."controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_framework_control_links" ADD CONSTRAINT "cross_framework_control_links_control_id_b_controls_id_fk" FOREIGN KEY ("control_id_b") REFERENCES "public"."controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_framework_id_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_descriptions" ADD CONSTRAINT "level_descriptions_control_id_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maturity_scales" ADD CONSTRAINT "maturity_scales_framework_id_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_control_id_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoping_questions" ADD CONSTRAINT "scoping_questions_framework_id_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_cycles" ADD CONSTRAINT "assessment_cycles_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_cycles" ADD CONSTRAINT "assessment_cycles_engagement_framework_id_engagement_frameworks_id_fk" FOREIGN KEY ("engagement_framework_id") REFERENCES "public"."engagement_frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessor_reviews" ADD CONSTRAINT "assessor_reviews_cycle_control_id_cycle_controls_id_fk" FOREIGN KEY ("cycle_control_id") REFERENCES "public"."cycle_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tokens" ADD CONSTRAINT "client_tokens_cycle_id_assessment_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."assessment_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_responses" ADD CONSTRAINT "control_responses_cycle_control_id_cycle_controls_id_fk" FOREIGN KEY ("cycle_control_id") REFERENCES "public"."cycle_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_controls" ADD CONSTRAINT "cycle_controls_cycle_id_assessment_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."assessment_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_controls" ADD CONSTRAINT "cycle_controls_control_id_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_scoping_answers" ADD CONSTRAINT "cycle_scoping_answers_cycle_id_assessment_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."assessment_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_scoping_answers" ADD CONSTRAINT "cycle_scoping_answers_scoping_question_id_scoping_questions_id_fk" FOREIGN KEY ("scoping_question_id") REFERENCES "public"."scoping_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_frameworks" ADD CONSTRAINT "engagement_frameworks_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_frameworks" ADD CONSTRAINT "engagement_frameworks_framework_id_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_cycle_control_id_cycle_controls_id_fk" FOREIGN KEY ("cycle_control_id") REFERENCES "public"."cycle_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_cycle_control_id_cycle_controls_id_fk" FOREIGN KEY ("cycle_control_id") REFERENCES "public"."cycle_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_amendments" ADD CONSTRAINT "response_amendments_control_response_id_control_responses_id_fk" FOREIGN KEY ("control_response_id") REFERENCES "public"."control_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_state_transitions" ADD CONSTRAINT "register_state_transitions_remediation_item_id_remediation_items_id_fk" FOREIGN KEY ("remediation_item_id") REFERENCES "public"."remediation_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_items" ADD CONSTRAINT "remediation_items_cycle_control_id_cycle_controls_id_fk" FOREIGN KEY ("cycle_control_id") REFERENCES "public"."cycle_controls"("id") ON DELETE cascade ON UPDATE no action;
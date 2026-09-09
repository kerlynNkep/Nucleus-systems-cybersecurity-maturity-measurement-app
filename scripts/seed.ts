/**
 * Seeds a demo engagement for Acacia Financial Services Ltd, built on
 * top of whatever the loader has already populated (run `pnpm
 * loader:cmmf` first). Unlike the loader, this script reads the
 * INSTANCE columns of the Acacia workbook — the client's actual scoping
 * answers, narratives, ratings and roadmap entries — never framework
 * definition. It walks the engagement through every lifecycle stage
 * (scoping -> questionnaire -> validation -> rating -> improvement plan
 * -> register -> complete) so there's realistic data to demo at every
 * stage without clicking through the UI first.
 *
 * Run: pnpm seed
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";

import { db } from "../db/client";
import {
  assessmentCycles,
  assessorReviews,
  clientTokens,
  clients,
  controlResponses,
  controlScopingRules,
  controls,
  cycleControls,
  cycleScopingAnswers,
  engagementFrameworks,
  engagements,
  frameworks,
  ratings,
  registerStateTransitions,
  remediationItems,
  scopingQuestions,
} from "../db/schema";
import { nsCmmfConfig as config } from "./frameworks/ns-cmmf.config";
import { num, sheetToRows, str } from "./lib/xlsx-helpers";
import { deriveGap } from "../lib/scoring";

const WORKBOOK_PATH = config.workbookPath;

async function main() {
  const [framework] = await db.select().from(frameworks).where(eq(frameworks.code, config.framework.code));
  if (!framework) {
    throw new Error(`Framework ${config.framework.code} not loaded — run "pnpm loader:cmmf" first.`);
  }

  const gvControls = await db.select().from(controls).where(eq(controls.frameworkId, framework.id));
  const controlByGlobalNumber = new Map(gvControls.map((c) => [c.globalNumber, c]));

  const workbook = XLSX.readFile(WORKBOOK_PATH);

  // --- Engagement setup ---
  const [client] = await db
    .insert(clients)
    .values({
      name: "Acacia Financial Services Ltd",
      primaryContactName: "Jean-Paul Nkeng",
      primaryContactEmail: "jp.nkeng@acacia-example.com",
    })
    .returning();
  const [engagement] = await db
    .insert(engagements)
    .values({ clientId: client.id, name: "2026 NS-CMMF Assessment", assessorName: "Nucleus Systems Lead Assessor" })
    .returning();
  const [engagementFramework] = await db
    .insert(engagementFrameworks)
    .values({ engagementId: engagement.id, frameworkId: framework.id })
    .returning();
  const [cycle] = await db
    .insert(assessmentCycles)
    .values({ engagementId: engagement.id, engagementFrameworkId: engagementFramework.id, cycleNumber: 1, status: "scoping" })
    .returning();
  console.log(`Engagement: ${client.name} / cycle ${cycle.cycleNumber} (${cycle.id})`);

  // --- Scoping: Acacia's real Yes/No answers from the 🔍 Scoping sheet. ---
  const questions = await db.select().from(scopingQuestions).where(eq(scopingQuestions.frameworkId, framework.id));
  const questionByCode = new Map(questions.map((q) => [q.code, q]));

  const scopingRows = sheetToRows(workbook, config.scopingQuestionsSheet.name);
  const { columns: sqCols } = config.scopingQuestionsSheet;
  const answerColumn = 4; // "Answer ▼" column on the assessment workbook's Scoping sheet
  let scopingAnswersLoaded = 0;
  for (const row of scopingRows) {
    const code = str(row[sqCols.code]);
    const question = questionByCode.get(code);
    if (!question) continue;
    const answerText = str(row[answerColumn]);
    const answer = answerText === "" ? null : answerText.toLowerCase() === "yes";
    await db.insert(cycleScopingAnswers).values({
      cycleId: cycle.id,
      scopingQuestionId: question.id,
      answer,
      answeredAt: answer == null ? null : new Date(),
    });
    scopingAnswersLoaded++;
  }
  console.log(`Scoping answers loaded: ${scopingAnswersLoaded}`);

  // --- Resolve scope for GV controls (mirrors finalizeScoping's logic). ---
  const answerByQuestionId = new Map(
    (await db.select().from(cycleScopingAnswers).where(eq(cycleScopingAnswers.cycleId, cycle.id))).map((a) => [
      a.scopingQuestionId,
      a.answer,
    ]),
  );
  const rules = await db.select().from(controlScopingRules);
  const rulesByControlId = new Map<string, string[]>();
  for (const rule of rules) {
    const list = rulesByControlId.get(rule.controlId) ?? [];
    list.push(rule.scopingQuestionId);
    rulesByControlId.set(rule.controlId, list);
  }

  const cycleControlByGlobalNumber = new Map<number, { id: string; controlId: string }>();
  for (const control of gvControls) {
    const requiredQuestionIds = rulesByControlId.get(control.id) ?? [];
    const failedQuestionId = requiredQuestionIds.find((qId) => answerByQuestionId.get(qId) === false);
    const inScope = failedQuestionId == null;
    const [cc] = await db
      .insert(cycleControls)
      .values({
        cycleId: cycle.id,
        controlId: control.id,
        inScope,
        exclusionReason: inScope ? null : "scoping_auto_excluded",
        excludedAt: inScope ? null : new Date(),
        excludedBy: inScope ? null : "system:seed-scoping-resolution",
      })
      .returning();
    cycleControlByGlobalNumber.set(control.globalNumber, { id: cc.id, controlId: control.id });
  }
  console.log(`Cycle controls resolved: ${cycleControlByGlobalNumber.size}`);

  const [clientToken] = await db
    .insert(clientTokens)
    .values({ cycleId: cycle.id, token: "acacia-demo-token" })
    .returning();
  console.log(`Client token: ${clientToken.token} -> /client/${clientToken.token}`);

  await db.update(assessmentCycles).set({ status: "questionnaire" }).where(eq(assessmentCycles.id, cycle.id));

  // --- Questionnaire: Acacia's real narrative/evidence answers (columns F/G/H) from the GV Govern sheet. ---
  const gvRows = sheetToRows(workbook, "GV Govern");
  const { columns: dc, dataStartRowIndex } = config.domainSheet;
  const responseColumns = { narrative: 5, evidenceHeld: 6, evidenceRef: 7, ratingLevel: 8, targetLevel: 10 };
  let responsesLoaded = 0;
  for (let r = dataStartRowIndex; r < gvRows.length; r++) {
    const row = gvRows[r];
    const globalNumber = num(row[dc.globalNumber]);
    if (globalNumber == null) continue;
    const cc = cycleControlByGlobalNumber.get(globalNumber);
    if (!cc) continue;

    await db.insert(controlResponses).values({
      cycleControlId: cc.id,
      currentStateNarrative: str(row[responseColumns.narrative]) || null,
      evidenceHeldNarrative: str(row[responseColumns.evidenceHeld]) || null,
      evidenceRegisterRef: str(row[responseColumns.evidenceRef]) || null,
      status: "submitted",
      submittedBy: "Jean-Paul Nkeng — Managing Director",
      submittedAt: new Date(),
    });
    responsesLoaded++;
  }
  console.log(`Responses loaded (submitted & locked): ${responsesLoaded}`);
  await db.update(assessmentCycles).set({ status: "validation" }).where(eq(assessmentCycles.id, cycle.id));

  // --- Validation: accept everything except one control, which we flag for interview to demo the agenda. ---
  let flaggedDemoed = false;
  for (const [globalNumber, cc] of cycleControlByGlobalNumber) {
    const decision = !flaggedDemoed && globalNumber === 6 ? "flagged_for_interview" : "accepted";
    if (decision === "flagged_for_interview") flaggedDemoed = true;
    await db.insert(assessorReviews).values({
      cycleControlId: cc.id,
      decision,
      reviewer: "Nucleus Systems Lead Assessor",
      notes: decision === "flagged_for_interview" ? "Narrative is thin — confirm in interview." : null,
      reviewedAt: new Date(),
    });
  }
  console.log("Validation complete: 1 control flagged for interview, rest accepted.");
  await db.update(assessmentCycles).set({ status: "rating" }).where(eq(assessmentCycles.id, cycle.id));

  // --- Rating: Acacia's real L1-L5 current/target ratings (columns I/K, parsed to plain integers). ---
  let ratingsLoaded = 0;
  let gapsCreated = 0;
  for (let r = dataStartRowIndex; r < gvRows.length; r++) {
    const row = gvRows[r];
    const globalNumber = num(row[dc.globalNumber]);
    if (globalNumber == null) continue;
    const cc = cycleControlByGlobalNumber.get(globalNumber);
    if (!cc) continue;

    const ratingText = str(row[responseColumns.ratingLevel]); // e.g. "L1 — Initial"
    const targetText = str(row[responseColumns.targetLevel]); // e.g. "L3 — Defined"
    const maturityLevel = ratingText ? Number(ratingText.match(/^L(\d)/)?.[1]) : null;
    const targetLevel = targetText ? Number(targetText.match(/^L(\d)/)?.[1]) : null;
    if (maturityLevel == null && targetLevel == null) continue;

    await db.insert(ratings).values({
      cycleControlId: cc.id,
      maturityLevel: maturityLevel ?? null,
      targetLevel: targetLevel ?? null,
      ratedBy: "Nucleus Systems Lead Assessor",
      ratedAt: new Date(),
    });
    ratingsLoaded++;

    const gap = deriveGap(maturityLevel ?? null, targetLevel ?? null);
    if (gap != null && gap > 0) {
      await db.insert(remediationItems).values({ cycleControlId: cc.id, lifecycleState: "assessed" });
      gapsCreated++;
    }
  }
  console.log(`Ratings loaded: ${ratingsLoaded}, remediation items created: ${gapsCreated}`);

  // --- Improvement plan: Acacia's real owner/effort/target-quarter/status/costs from the Roadmap sheet. ---
  const roadmapRows = sheetToRows(workbook, "🗺️ Roadmap");
  const roadmapCols = {
    effort: 4,
    targetQuarter: 5,
    owner: 6,
    status: 7,
    costInternal: 9,
    costExternalOnceOff: 10,
    costExternalRecurring: 11,
    costTooling: 12,
  };
  let planItemsUpdated = 0;
  for (let r = 4; r < roadmapRows.length; r++) {
    const globalNumber = r - 4 + 1; // Roadmap rows are in the same global 1..188 order as every other sheet
    const cc = cycleControlByGlobalNumber.get(globalNumber);
    if (!cc) continue;
    const [remediation] = await db
      .select()
      .from(remediationItems)
      .where(eq(remediationItems.cycleControlId, cc.id));
    if (!remediation) continue;

    const row = roadmapRows[r];
    // The Roadmap sheet's own "Status" column includes "Deferred" as a
    // value, but that's a lifecycle decision in our model (see the
    // register-demo transitions below), not a remediation_status value —
    // everything here starts "not_started" regardless of what the sheet says.
    await db
      .update(remediationItems)
      .set({
        owner: str(row[roadmapCols.owner]) || null,
        effortEstimate: str(row[roadmapCols.effort]) || null,
        targetQuarter: str(row[roadmapCols.targetQuarter]) || null,
        status: "not_started",
        costInternal: str(row[roadmapCols.costInternal]).replace(/,/g, "") || null,
        costExternalOnceOff: str(row[roadmapCols.costExternalOnceOff]).replace(/,/g, "") || null,
        costExternalRecurring: str(row[roadmapCols.costExternalRecurring]).replace(/,/g, "") || null,
        costTooling: str(row[roadmapCols.costTooling]).replace(/,/g, "") || null,
      })
      .where(eq(remediationItems.id, remediation.id));
    planItemsUpdated++;
  }
  console.log(`Improvement plan details populated from Roadmap: ${planItemsUpdated}`);

  // --- Drive a handful of remediation items through the full lifecycle to demonstrate the register. ---
  const allRemediations = await db
    .select({ remediation: remediationItems, control: controls })
    .from(remediationItems)
    .innerJoin(cycleControls, eq(cycleControls.id, remediationItems.cycleControlId))
    .innerJoin(controls, eq(controls.id, cycleControls.controlId))
    .where(eq(cycleControls.cycleId, cycle.id));

  async function transition(remediationId: string, from: string, to: string, actor: string, rationale?: string) {
    await db.insert(registerStateTransitions).values({ remediationItemId: remediationId, fromState: from as never, toState: to as never, actor, rationale: rationale ?? null });
  }

  // Demo #1: DEFERRED — plan it, then defer past this improvement cycle.
  const deferItem = allRemediations[0];
  if (deferItem) {
    await transition(deferItem.remediation.id, "assessed", "remediation_planned", "Nucleus Systems Lead Assessor");
    await transition(
      deferItem.remediation.id,
      "remediation_planned",
      "deferred",
      "Jean-Paul Nkeng — Managing Director",
      "Budget for this control is not approved until next fiscal year.",
    );
    await transition(deferItem.remediation.id, "deferred", "registered", "Jean-Paul Nkeng — Managing Director", "Automatically registered: deferred decision recorded.");
    await db
      .update(remediationItems)
      .set({
        lifecycleState: "registered",
        decision: "deferred",
        decisionMaker: "Jean-Paul Nkeng — Managing Director",
        decisionRationale: "Budget for this control is not approved until next fiscal year.",
        reviewDate: new Date("2027-03-31"),
      })
      .where(eq(remediationItems.id, deferItem.remediation.id));
    console.log(`Register demo — DEFERRED: ${deferItem.control.code}`);
  }

  // Demo #2: ACCEPTED — client accepts a compensating control that doesn't reach target.
  const acceptItem = allRemediations.find((r) => r.remediation.id !== deferItem?.remediation.id);
  if (acceptItem) {
    await transition(acceptItem.remediation.id, "assessed", "remediation_planned", "Nucleus Systems Lead Assessor");
    await transition(
      acceptItem.remediation.id,
      "remediation_planned",
      "accepted",
      "Jean-Paul Nkeng — Managing Director",
      "Compensating control (manual quarterly review) accepted in lieu of full automation.",
    );
    await transition(acceptItem.remediation.id, "accepted", "registered", "Jean-Paul Nkeng — Managing Director", "Automatically registered: accepted decision recorded.");
    await db
      .update(remediationItems)
      .set({
        lifecycleState: "registered",
        decision: "accepted",
        decisionMaker: "Jean-Paul Nkeng — Managing Director",
        decisionRationale: "Compensating control (manual quarterly review) accepted in lieu of full automation.",
        reviewDate: new Date("2026-12-31"),
      })
      .where(eq(remediationItems.id, acceptItem.remediation.id));
    console.log(`Register demo — ACCEPTED: ${acceptItem.control.code}`);
  }

  // Demo #3: OVERDUE — a remediation item planned with a target date in the past, still in progress.
  const overdueItem = allRemediations.find(
    (r) => r.remediation.id !== deferItem?.remediation.id && r.remediation.id !== acceptItem?.remediation.id,
  );
  if (overdueItem) {
    await transition(overdueItem.remediation.id, "assessed", "remediation_planned", "Nucleus Systems Lead Assessor");
    await db
      .update(remediationItems)
      .set({ lifecycleState: "remediation_planned", status: "in_progress", reviewDate: new Date("2026-01-01") })
      .where(eq(remediationItems.id, overdueItem.remediation.id));
    console.log(`Register demo — OVERDUE (target date passed, still in progress): ${overdueItem.control.code}`);
  }

  await db.update(assessmentCycles).set({ status: "complete" }).where(eq(assessmentCycles.id, cycle.id));

  console.log("\nSeed complete.");
  console.log(`Engagement: /engagements/${engagement.id}`);
  console.log(`Cycle: /cycles/${cycle.id}`);
  console.log(`Client link: /client/${clientToken.token}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

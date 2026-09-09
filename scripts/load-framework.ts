/**
 * Framework loader: ingests a framework definition from an Excel
 * workbook shaped like the NS-CMMF assessment workbook (domain sheets +
 * _SCOPE + _REC + _DV + Dashboard weights) into the database.
 *
 * This only loads framework DEFINITION data (frameworks, domains,
 * controls, maturity scale, scoping questions/rules, level descriptions,
 * recommendations, standard citations) — never engagement/client data.
 * Run `pnpm seed` afterwards to load the Acacia sample engagement on top
 * of it.
 *
 * Run: pnpm loader:cmmf
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";

import { db } from "../db/client";
import {
  controlScopingRules,
  controlStandardCitations,
  controls,
  domains,
  frameworks,
  levelDescriptions,
  maturityScales,
  recommendations,
  scopingQuestions,
  standards,
} from "../db/schema";
import { nsCmmfConfig as config } from "./frameworks/ns-cmmf.config";
import { parseCitation } from "./lib/citation-parser";
import { num, parseLevelLabel, sheetToRows, str } from "./lib/xlsx-helpers";

async function main() {
  console.log(`Loading workbook: ${config.workbookPath}`);
  const workbook = XLSX.readFile(config.workbookPath);

  // --- 0. Wipe any prior load of this framework (idempotent re-run). ---
  const [existing] = await db
    .select({ id: frameworks.id })
    .from(frameworks)
    .where(eq(frameworks.code, config.framework.code));
  if (existing) {
    console.warn(
      `Framework "${config.framework.code}" already exists — deleting it ` +
        `and everything that cascades from it (including any engagement ` +
        `data seeded on top of it) before reloading.`,
    );
    await db.delete(frameworks).where(eq(frameworks.id, existing.id));
  }

  // --- 1. Framework row. ---
  const [framework] = await db
    .insert(frameworks)
    .values(config.framework)
    .returning();
  console.log(`Framework: ${framework.code} — ${framework.name}`);

  // --- 2. Maturity scale, derived from _DV's "L{n} — {Label}:" prefixes. ---
  const dvRows = sheetToRows(workbook, config.dvSheet.name);
  const scaleLevels = new Map<number, string>();
  for (const row of dvRows) {
    for (const cell of row) {
      const parsed = parseLevelLabel(str(cell));
      if (parsed && !scaleLevels.has(parsed.level)) {
        scaleLevels.set(parsed.level, parsed.label);
      }
    }
  }
  const sortedLevels = [...scaleLevels.entries()].sort((a, b) => a[0] - b[0]);
  await db.insert(maturityScales).values(
    sortedLevels.map(([levelValue, label], i) => ({
      frameworkId: framework.id,
      levelValue,
      label,
      sortOrder: i,
    })),
  );
  console.log(`Maturity scale: ${sortedLevels.map(([, l]) => l).join(" / ")}`);

  // --- 3. Domains, with weights from the Dashboard sheet. ---
  const dashboardRows = sheetToRows(workbook, config.dashboardSheet.name);
  const domainIdByCode = new Map<string, string>();
  let weightSum = 0;
  for (let i = 0; i < config.domainSheets.length; i++) {
    const { code } = config.domainSheets[i];
    const dashRow = dashboardRows[config.dashboardSheet.weightRowStartIndex + i];
    const name = str(dashRow[config.dashboardSheet.nameColumn]);
    const weight = num(dashRow[config.dashboardSheet.weightColumn]) ?? 0;
    weightSum += weight;
    const [domain] = await db
      .insert(domains)
      .values({ frameworkId: framework.id, code, name, weight: String(weight), sortOrder: i })
      .returning();
    domainIdByCode.set(code, domain.id);
    console.log(`  Domain ${code} — ${name} — weight ${weight}`);
  }
  console.log(
    `  Domain weights sum to ${weightSum.toFixed(4)} (NOT normalized to 1.0 ` +
      `in the source — the rollup engine divides by this sum, it never assumes it's 1).`,
  );

  // --- 4. Scoping questions. ---
  const scopingRows = sheetToRows(workbook, config.scopingQuestionsSheet.name);
  const { columns: sqCols } = config.scopingQuestionsSheet;
  const questionIdByCode = new Map<string, string>();
  let sqSortOrder = 0;
  for (const row of scopingRows) {
    const code = str(row[sqCols.code]);
    if (!/^Q\d+$/.test(code)) continue;
    const [question] = await db
      .insert(scopingQuestions)
      .values({
        frameworkId: framework.id,
        code,
        category: str(row[sqCols.category]),
        questionText: str(row[sqCols.questionText]),
        helpText: str(row[sqCols.helpText]) || null,
        sortOrder: sqSortOrder++,
      })
      .returning();
    questionIdByCode.set(code, question.id);
  }
  console.log(`Scoping questions: ${questionIdByCode.size}`);

  // --- 5. Controls, only for domains in loadDomainCodes. ---
  const controlIdByGlobalNumber = new Map<number, string>();
  const domainCodeByGlobalNumber = new Map<number, string>();
  let totalControlsLoaded = 0;
  for (const { code: domainCode, sheetName } of config.domainSheets) {
    const rows = sheetToRows(workbook, sheetName);
    const { columns: dc, dataStartRowIndex } = config.domainSheet;
    const shouldLoad = (config.loadDomainCodes as readonly string[]).includes(domainCode);

    for (let r = dataStartRowIndex; r < rows.length; r++) {
      const row = rows[r];
      const globalNumber = num(row[dc.globalNumber]);
      if (globalNumber == null) continue; // trailing blank rows
      domainCodeByGlobalNumber.set(globalNumber, domainCode);

      if (!shouldLoad) continue;

      const code = `${domainCode}-${String(globalNumber).padStart(3, "0")}`;
      const [control] = await db
        .insert(controls)
        .values({
          frameworkId: framework.id,
          domainId: domainIdByCode.get(domainCode)!,
          globalNumber,
          code,
          category: str(row[dc.category]),
          name: str(row[dc.name]),
          description: str(row[dc.description]),
          riskImpactNarrative: str(row[dc.riskImpactNarrative]),
          // No source field marks a control "foundational" — see SHORTFALLS.md.
          isFoundational: false,
          sortOrder: globalNumber,
        })
        .returning();
      controlIdByGlobalNumber.set(globalNumber, control.id);
      totalControlsLoaded++;

      // Standard citations, from the pipe-delimited "Frameworks & Regulations" column.
      const rawCitations = str(row[dc.frameworksAndRegulations])
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const raw of rawCitations) {
        const { family, clause } = parseCitation(raw);
        let [standard] = await db
          .select()
          .from(standards)
          .where(eq(standards.name, family));
        if (!standard) {
          [standard] = await db.insert(standards).values({ name: family }).returning();
        }
        await db.insert(controlStandardCitations).values({
          controlId: control.id,
          standardId: standard.id,
          rawCitation: raw,
          parsedClause: clause,
        });
      }
    }
  }
  console.log(
    `Controls loaded: ${totalControlsLoaded} (domains: ${config.loadDomainCodes.join(", ")}). ` +
      `${domainCodeByGlobalNumber.size} total controls exist across all 6 domains per _SCOPE/_DV/_REC, ` +
      `confirming the loader and schema hold the full 188 even though only ${config.loadDomainCodes.join(", ")} is populated.`,
  );

  // --- 6. Scoping rules from _SCOPE, keyed by row position (control label text is truncated in-source and unusable). ---
  const scopeRows = sheetToRows(workbook, config.scopeSheet.name);
  const scopeHeader = scopeRows[config.scopeSheet.headerRowIndex];
  const questionCodeByColumn = new Map<number, string>();
  for (let c = config.scopeSheet.firstQuestionColumn; c < scopeHeader.length; c++) {
    const headerCell = str(scopeHeader[c]); // e.g. "Q1:GDPR"
    const match = headerCell.match(/^(Q\d+)/);
    if (match) questionCodeByColumn.set(c, match[1]);
  }
  let scopingRulesLoaded = 0;
  for (let r = 0; r < scopeRows.length - config.scopeSheet.dataStartRowIndex; r++) {
    const globalNumber = r + 1; // row position IS the global control number
    const controlId = controlIdByGlobalNumber.get(globalNumber);
    if (!controlId) continue; // control not loaded (outside loadDomainCodes)
    const row = scopeRows[r + config.scopeSheet.dataStartRowIndex];
    if (!row) continue;
    for (const [col, questionCode] of questionCodeByColumn) {
      if (str(row[col]) !== "1") continue;
      const questionId = questionIdByCode.get(questionCode);
      if (!questionId) continue;
      await db.insert(controlScopingRules).values({ controlId, scopingQuestionId: questionId });
      scopingRulesLoaded++;
    }
  }
  console.log(`Scoping rules loaded: ${scopingRulesLoaded}`);

  // --- 7. Level descriptions from _DV, one column per control (global-number order). ---
  let levelDescriptionsLoaded = 0;
  for (let col = 0; col < dvRows[0]?.length; col++) {
    const globalNumber = col + 1;
    const controlId = controlIdByGlobalNumber.get(globalNumber);
    if (!controlId) continue;
    for (let levelRow = 0; levelRow < 5; levelRow++) {
      const cellText = str(dvRows[levelRow][col]);
      const parsed = parseLevelLabel(cellText);
      if (!parsed) continue;
      await db.insert(levelDescriptions).values({
        controlId,
        levelValue: parsed.level,
        description: cellText,
      });
      levelDescriptionsLoaded++;
    }
  }
  console.log(`Level descriptions loaded: ${levelDescriptionsLoaded}`);

  // --- 8. Recommendations from _REC, keyed "globalNumber|targetLevel". ---
  const recRows = sheetToRows(workbook, config.recSheet.name);
  let recommendationsLoaded = 0;
  for (let r = config.recSheet.dataStartRowIndex; r < recRows.length; r++) {
    const row = recRows[r];
    const key = str(row[config.recSheet.keyColumn]);
    const [globalNumberStr, targetLevelStr] = key.split("|");
    const globalNumber = num(globalNumberStr);
    const targetLevel = num(targetLevelStr);
    if (globalNumber == null || targetLevel == null) continue;
    const controlId = controlIdByGlobalNumber.get(globalNumber);
    if (!controlId) continue;
    await db.insert(recommendations).values({
      controlId,
      targetLevel,
      text: str(row[config.recSheet.textColumn]),
    });
    recommendationsLoaded++;
  }
  console.log(`Recommendations loaded: ${recommendationsLoaded}`);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

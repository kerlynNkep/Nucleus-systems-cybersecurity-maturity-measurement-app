/**
 * Sheet/column addressing for the NS-CMMF workbook shape. This is the
 * "manifest" a loader run needs — WHERE to read things from — not the
 * framework's content, which is read from the workbook at load time.
 * Adding NS-PQCF (framework two) means writing a new file like this one,
 * not touching the loader's logic — unless its workbook shape genuinely
 * differs (a "readiness criterion" sheet may not share this A–T layout
 * at all; see SHORTFALLS.md on how far this generalises).
 *
 * `loadDomainCodes` limits which domains get their controls (and
 * everything keyed off a control — scoping rules, level descriptions,
 * recommendations, citations) loaded, per the brief: prove the schema
 * and loader hold all 188 controls across 6 domains, but only populate
 * GV. Domain *metadata* (name, weight) is loaded for all 6 regardless,
 * since that's needed for the rollup engine to make sense of partial
 * coverage and weight normalization.
 */
export const nsCmmfConfig = {
  workbookPath: "reference/NS_CMMF_Acacia_Financial_Services_Assessment.xlsx",

  framework: {
    code: "NS-CMMF",
    name: "Cybersecurity Maturity Management Framework",
    version: "v1.0",
    assessmentUnitSingular: "Control",
    assessmentUnitPlural: "Controls",
    description:
      "NIST CSF 2.0, ISO 27001, DORA and NIS2-aligned cybersecurity maturity framework.",
  },

  loadDomainCodes: ["GV"],

  domainSheets: [
    { code: "GV", sheetName: "GV Govern" },
    { code: "ID", sheetName: "ID Identify" },
    { code: "PR", sheetName: "PR Protect" },
    { code: "DE", sheetName: "DE Detect" },
    { code: "RS", sheetName: "RS Respond" },
    { code: "RC", sheetName: "RC Recover" },
  ],

  // Domain sheet layout (0-indexed columns), header on row index 2 (row 3),
  // data from row index 3 (row 4) onward.
  domainSheet: {
    headerRowIndex: 2,
    dataStartRowIndex: 3,
    columns: {
      globalNumber: 0, // A: "#"
      category: 1, // B
      name: 2, // C: Control Name
      description: 3, // D: Control Description
      riskImpactNarrative: 4, // E: Risk & Maturity Impact
      frameworksAndRegulations: 16, // Q: pipe-delimited citations
    },
  },

  // Dashboard sheet: domain weight table, rows 6-11 (index 5-10), in the
  // same GV/ID/PR/DE/RS/RC order as domainSheets above.
  dashboardSheet: {
    name: "📊 Dashboard",
    weightRowStartIndex: 5,
    weightRowCount: 6,
    nameColumn: 2,
    weightColumn: 3,
  },

  scopingQuestionsSheet: {
    name: "🔍 Scoping",
    columns: {
      code: 1, // B: "Q1"
      category: 2, // C
      questionText: 3, // D
      helpText: 5, // F: "Why This Matters"
    },
  },

  // _SCOPE: header row 0 has one column per scoping question (in Q1..Q23
  // order); data rows 1..188 are controls in global-number order — a "1"
  // in a question's column means "this control requires Yes on that
  // question to stay in scope". The control-label column (A) is
  // truncated to ~30 chars in the source file and unusable as a join key
  // — global row order is used instead.
  scopeSheet: {
    name: "_SCOPE",
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    firstQuestionColumn: 1,
  },

  // _REC: one row per "globalNumber|targetLevel" key, target levels 2-5.
  recSheet: {
    name: "_REC",
    dataStartRowIndex: 1,
    keyColumn: 0,
    textColumn: 1,
  },

  // _DV: 5 rows (L1..L5) x 188 columns, one column per control in
  // global-number order.
  dvSheet: {
    name: "_DV",
  },
} as const;

export type NsCmmfConfig = typeof nsCmmfConfig;

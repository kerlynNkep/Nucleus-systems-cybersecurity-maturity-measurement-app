/**
 * Framework-specific knowledge the generic register engine deliberately
 * doesn't have: which standard family corresponds to which NS-CMMF
 * scoping question, and what maturity floor counts as "meeting" a
 * regulatory mandate.
 *
 * The source workbook never defines a "mandated floor" anywhere — there
 * is no cell, formula or comment that states a minimum acceptable level
 * per regulation. L3 ("Defined" — documented, consistently applied,
 * evidence routinely collected) is the default target level the
 * workbook itself assigns to every control in the Acacia sample, so we
 * use it as the floor. This is our own operating assumption, not
 * something read out of the source data — flagged in SHORTFALLS.md.
 */
export const MANDATED_FLOOR_LEVEL = 3;

export const STANDARD_TO_SCOPING_QUESTION: Record<string, string> = {
  GDPR: "Q1",
  NIS2: "Q2",
  DORA: "Q3",
  "PCI DSS": "Q4",
  HIPAA: "Q5",
  SOX: "Q6",
  CCPA: "Q7",
  CRA: "Q8",
  FedRAMP: "Q9",
};

export type MandateShortfallInput = {
  maturityLevel: number | null;
  /** Standard names cited by this control (mandatory citations only). */
  citedStandardNames: string[];
  /** This engagement's scoping answers, by question code, true = "Yes". */
  scopingAnswers: Record<string, boolean | null>;
};

/**
 * True when the control cites a regulation the client is in scope for
 * (per their scoping answers) and the control's current rating sits
 * below the mandated floor.
 */
export function computeMandateShortfall(input: MandateShortfallInput): boolean {
  if (input.maturityLevel == null || input.maturityLevel >= MANDATED_FLOOR_LEVEL) {
    return false;
  }
  return input.citedStandardNames.some((standard) => {
    const questionCode = STANDARD_TO_SCOPING_QUESTION[standard];
    if (!questionCode) return false;
    return input.scopingAnswers[questionCode] === true;
  });
}

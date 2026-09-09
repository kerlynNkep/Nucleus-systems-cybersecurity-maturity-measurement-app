/**
 * Splits a raw standard citation (e.g. "NIS2 Art.20", "COBIT APO01",
 * "HIPAA S164.514") into a standard family name and a best-effort clause
 * reference.
 *
 * The source data has no consistent delimiter between standard and
 * clause — space+"Art.", a bare section symbol, "A.5.2"-style ISO
 * numbering, "S164.514"-style HIPAA numbering, "GV.OC-01"-style NIST CSF
 * subcategory codes, version suffixes ("v8"), and bare alphanumeric
 * process codes ("APO01") with NO delimiter at all. This function
 * applies the patterns actually observed in NS-CMMF's citations, in
 * order, and falls back to treating the whole string as the family.
 *
 * Known limitation (see SHORTFALLS.md): "COBIT 2019" (a version, meant
 * to stand alone) and "COBIT APO01" (a process-area clause) are
 * indistinguishable by pattern alone — both are "COBIT " + an
 * alphanumeric-ish suffix. This parser keeps "COBIT 2019" intact (pure
 * digits look like a version) but strips "APO01" as a clause, so the two
 * citations resolve to different standard families ("COBIT 2019" vs
 * "COBIT"). That's a real data-quality gap in the source text, not a bug
 * here — a clean fix needs per-standard curation, not a smarter regex.
 */
export type ParsedCitation = {
  family: string;
  clause: string | null;
};

const CLAUSE_SUFFIX_PATTERNS: RegExp[] = [
  /\s+Art\..*$/, // "NIS2 Art.20", "DORA Art.28-44"
  /\s+§.*$/, // "HIPAA §164.308"
  /\s+A\.\d[\d.]*$/, // "ISO 27001 A.5.2"
  /\s+S\d[\d.()A-Za-z]*$/, // "HIPAA S164.514"
  /\s+GV\.[A-Z.\-\d]*$/, // "NIST CSF GV.OC-01"
  /\s+PM-\d+$/, // "NIST SP 800-53 PM-4"
  /\s+v\d+(\.\d+)*$/, // "CIS Controls v8.1"
  /\s+\d+\.\d+$/, // "ISO 27001 6.2"
  /\s+[A-Z]{2,6}\d{1,3}(-\d+)?$/, // "COBIT APO01", "OWASP LLM01"
];

export function parseCitation(raw: string): ParsedCitation {
  const trimmed = raw.trim();
  for (const pattern of CLAUSE_SUFFIX_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        family: trimmed.slice(0, match.index).trim(),
        clause: match[0].trim(),
      };
    }
  }
  return { family: trimmed, clause: null };
}

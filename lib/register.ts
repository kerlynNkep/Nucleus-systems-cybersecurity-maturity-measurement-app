/**
 * The gap-to-register promotion engine.
 *
 * A gap is promoted to the register when someone decides not to close it
 * — never because someone judged it dangerous. There is no likelihood/
 * impact scoring, no heat map, no severity field, and no free-text entry:
 * every register row is a remediation_items row, computed from a real
 * control gap. The register itself is not a table — it's whatever a
 * caller gets back by filtering remediationItems to rows this function
 * says should be registered, ordered by the trigger that fired.
 *
 * Priority when more than one trigger fires simultaneously:
 *   MANDATE_SHORTFALL > FOUNDATIONAL_ABSENCE > OVERDUE > DEFERRED > ACCEPTED
 */

export type RegisterTrigger =
  | "MANDATE_SHORTFALL"
  | "FOUNDATIONAL_ABSENCE"
  | "OVERDUE"
  | "DEFERRED"
  | "ACCEPTED";

export const TRIGGER_PRIORITY: RegisterTrigger[] = [
  "MANDATE_SHORTFALL",
  "FOUNDATIONAL_ABSENCE",
  "OVERDUE",
  "DEFERRED",
  "ACCEPTED",
];

export type RegisterEvaluationInput = {
  /** target - current, from the rating. Only a positive gap can register. */
  gap: number | null;
  /** The assessor's explicit decision on this remediation item, if any. */
  decision: "deferred" | "accepted" | null;
  /** Whether the remediation item has a committed target date that has passed. */
  remediationStatus: "not_started" | "in_progress" | "complete";
  targetDate: Date | null;
  now: Date;
  /** Control facts. */
  isFoundational: boolean;
  maturityLevel: number | null;
  /**
   * Whether this control cites a regulatory/contractual obligation the
   * client is in scope for (per the engagement's scoping answers) and
   * sits below that obligation's mandated floor. Computed by the caller
   * (see mandateShortfall.ts) because "in scope for this obligation" and
   * "mandated floor" are framework-specific business knowledge, not
   * something this generic engine should know.
   */
  mandateShortfall: boolean;
  /** Already closed — never re-registers regardless of the above. */
  lifecycleState:
    | "assessed"
    | "remediation_planned"
    | "deferred"
    | "accepted"
    | "registered"
    | "closed";
};

/**
 * Returns the trigger that promotes this gap to the register, or null if
 * none of the five conditions hold (the gap is still being actively
 * worked, with no overdue date, no mandate shortfall, and no decision to
 * defer or accept it).
 */
export function computeRegisterTrigger(
  input: RegisterEvaluationInput,
): RegisterTrigger | null {
  if (input.lifecycleState === "closed") return null;
  if (input.gap == null || input.gap <= 0) return null;

  const firing = new Set<RegisterTrigger>();

  if (input.mandateShortfall) firing.add("MANDATE_SHORTFALL");
  if (input.isFoundational && input.maturityLevel === 1) {
    firing.add("FOUNDATIONAL_ABSENCE");
  }
  if (
    input.remediationStatus !== "complete" &&
    input.targetDate != null &&
    input.targetDate.getTime() < input.now.getTime()
  ) {
    firing.add("OVERDUE");
  }
  if (input.decision === "deferred") firing.add("DEFERRED");
  if (input.decision === "accepted") firing.add("ACCEPTED");

  for (const trigger of TRIGGER_PRIORITY) {
    if (firing.has(trigger)) return trigger;
  }
  return null;
}

export type RegisterEntry<T> = T & { trigger: RegisterTrigger };

/**
 * Filters and sorts a list of remediation items (plus whatever evaluation
 * facts each one carries) into register order. `evaluate` maps each item
 * to its RegisterEvaluationInput so this stays decoupled from the DB
 * row shape.
 */
export function buildRegisterView<T>(
  items: T[],
  evaluate: (item: T) => RegisterEvaluationInput,
): RegisterEntry<T>[] {
  const entries: RegisterEntry<T>[] = [];
  for (const item of items) {
    const trigger = computeRegisterTrigger(evaluate(item));
    if (trigger) entries.push({ ...item, trigger });
  }
  return entries.sort(
    (a, b) => TRIGGER_PRIORITY.indexOf(a.trigger) - TRIGGER_PRIORITY.indexOf(b.trigger),
  );
}

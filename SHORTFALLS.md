# SHORTFALLS.md

Direct findings from building this prototype, in the order they matter.
Everything here is grounded in something I actually checked — a cell
value, a formula, a grep across the workbook — not a guess. Where I made a
judgment call in the absence of source data, I've said so explicitly and
flagged it as something Nucleus's own SMEs need to sign off on, not
something the model resolved on its own.

## 1. The workbook's own methodology isn't implemented in the workbook

This is the single most important finding, and the one most likely to
surprise leadership.

The Overview sheet documents a "5-Axis Scoring Model":

> Each control is scored across five independent dimensions: Design
> Adequacy (20%), Implementation Coverage (25%), Operating Effectiveness
> (25%), Monitoring & Assurance (20%), Automation & Resilience (10%).
> Composite Score = Design×0.20 + Coverage×0.25 + Operating×0.25 +
> Monitoring×0.20 + Automation×0.10

...and seven "Hard Scoring Gates" that are supposed to cap maturity
regardless of the composite score ("No named owner → Maximum L2", "Tier 4
attestation-only evidence → Maximum L1.5", etc.).

**None of this exists as a formula anywhere in the workbook.** I grepped
every formula cell across both workbooks for "axis", "Design Adequacy",
and "Hard Scoring Gate" — zero matches outside the narrative text cells on
Overview, Dashboard, Board Report, Evidence Register and Instructions. The
actual mechanism, confirmed in `GV Govern!J4`, is:

```
=IF(I4="","",IF(LEFT(I4,2)="L1",1,IF(LEFT(I4,2)="L2",2,...
```

— a direct, single-dropdown L1–L5 pick. No composite, no gates, no
five-dimension anything. The assessor selects a level; that's the score.

**I built the platform to match what the workbook actually does**, not
what its own documentation claims it does — a rating is a single L1–L5
pick, full stop. If Nucleus's commercial story depends on the 5-axis/
hard-gates methodology being real, that methodology needs to be designed
and built from scratch; it isn't something this prototype ported, because
there was nothing to port. This is a decision for Nucleus leadership, not
something I resolved unilaterally.

## 2. The "auto-exclusion" the brief described doesn't exist in the source either

I traced every formula that reads or writes the per-control "Scope" /
"Eff. Scope" columns (`S`/`T` on each domain sheet). The Status and
summary-count formulas check for a status string, `⬛ Auto-Excluded`, that
**no formula in the workbook ever produces** — `T` only ever resolves to
`✅ Applicable` or `⬛ Excluded`, and that's driven by a **manual** dropdown
the assessor sets by hand, control by control. The Scoping tab's "Controls
Affected if No" column (e.g. "8 controls") is plain typed text, not a
formula either.

I verified this against Acacia: control 21 (DORA TPSP Critical Register)
*was* correctly excluded because Q3 (DORA) was answered "No" and `_SCOPE`
flags that control against DORA — but a human read `_SCOPE` and set the
dropdown by hand. Nothing computed it.

**This platform actually builds the automation the workbook only gestures
at** (`lib/actions/engagement.ts:finalizeScoping`, materializing
`cycle_controls` from `control_scoping_rules` × `cycle_scoping_answers`).
That's a genuine improvement over the source, not a port — worth knowing
so nobody expects behavioral parity with the Excel here.

## 3. Domain weights don't sum to 1.0 — and the rollup formula knows it

GV 0.16 + ID 0.10 + PR 0.26 + DE 0.14 + RS 0.11 + RC 0.10 = **0.87**, not
1.0. The workbook's own weighted-overall formula compensates:
`=(E6*D6+E7*D7+...)/(D6+D7+...)` — dividing by the sum of the weights
actually in play, never assuming they're normalized.

`lib/scoring.ts:rollupOverall` replicates this exactly, and
`lib/__tests__/scoring.test.ts` asserts the platform's output against the
Dashboard's own computed cells (1.2333/3.4034 to 6 decimal places) — not
just internal consistency. Any future implementation that assumes
domain weights sum to 1 will silently produce wrong numbers the moment a
framework (this one included) doesn't total 100%.

**Untested by the source**: the source workbook always has all 188
controls, all 6 domains, always rated. Ours has only GV loaded, so I had
to decide what "weighted overall" means when 5 of 6 domains have nothing
rated at all. I chose to exclude a domain with zero rated controls from
both the numerator and denominator (same spirit as "excluded controls
must not drag the average down," extended to "an entirely unrated domain
must not read as a zero"). That's my extrapolation, not something the
source ever demonstrated — flagged in `lib/scoring.ts`'s doc comment.

## 4. `_DV` and `_REC` are 100% generated from templates, not curated per control

I diffed every one of the 940 `_DV` cells (188 controls × 5 levels)
against the five stock sentences ("L1 — Initial: {name} is absent or ad
hoc...") — zero deviations, control name substituted, nothing else
changes. Same result for all 752 `_REC` rows against the four
target-level templates. This means "per-control level descriptions" is
technically true but slightly misleading — it's one template × control
name, not bespoke content. I still store the *resolved* text as data per
control (not a template mechanism) per the "everything is data" mandate,
because I can't assume every future framework will be this uniform — but
if you're budgeting content-authoring effort for framework two, know that
NS-CMMF's per-control descriptions cost approximately zero incremental
authoring beyond the five/four templates and 188 names.

## 5. Standard citations can't be reliably split into standard + clause

637 citation instances across GV's 28 controls collapse to 201 distinct
raw strings — not because there are 201 standards, but because there's no
consistent delimiter between a standard name and its clause:

| Format | Example |
|---|---|
| space + "Art." | `NIS2 Art.20` |
| no separator at all | `COBIT APO01` |
| "§" | (seen in other domains) `HIPAA §164.308` |
| ISO clause numbering | `ISO 27001 A.5.2` |
| HIPAA section numbering | `HIPAA S164.514` |
| NIST CSF subcategory | `NIST CSF GV.OC-01` |
| version suffix | `CIS Controls v8.1` |
| clause range | `DORA Art.28-44` |
| parenthetical | (seen elsewhere) `OWASP LLM Top 10 (LLM01)` |

`scripts/lib/citation-parser.ts` applies pattern-based heuristics that get
GV's set down to 21 clean families — good enough for a working many-to-
many, but with a known, permanent ambiguity: `COBIT 2019` (a version,
meant to stand alone) and `COBIT APO01` (a process-area clause) are both
"COBIT " + an alphanumeric-looking suffix, and no regex can tell them
apart. They resolve to two different `standards` rows (`COBIT 2019` and
`COBIT`). Fixing this needs a hand-curated per-standard alias table, not a
smarter parser — budget for that if the register's `MANDATE_SHORTFALL`
trigger needs to be reliable across all 188 controls, not just GV's.

## 6. `_SCOPE`'s control-label column is truncated in the source file itself

`_SCOPE!A2` is literally the string `"001: CISO / Security Leadershi"` —
cut off mid-word, not a display artifact. I confirmed this by reading the
raw cell value, not a column-width-limited view. This ruled out joining
`_SCOPE` rows to controls by label text; the loader joins by row position
(row N ↔ global control N) instead, which happens to be 100% reliable
across `_SCOPE`, `_REC`, and `_DV` in this workbook, but is a fragile
convention future framework authors need to preserve exactly, or a
loader for framework two will silently misjoin.

## 7. `_SCOPE` is real but sparse — not empty, not dense

You flagged this as worth checking. Verified: 61 of 188 controls (32%)
carry at least one scoping dependency; the other 127 have none and are
always in scope regardless of answers. Not the "no flags set" you
suspected from sampling the first few rows (those happen to be
Leadership & Strategy controls, which are universally applicable — the
flags start appearing at control 17, Third-Party Risk Management).

## 8. GV has 28 controls, not 20

Flagged before building: domain sizes are GV 28, ID 22, PR 83, DE 22, RS
16, RC 17 (sums to 188). There's no natural 20-control cut of GV. Built
against the full 28-control domain.

## 9. Evidence Register is 1:1 with controls in the source, not 1:many

Acacia's register has exactly 188 rows — one evidence slot per control,
not a repeatable list of artefacts. The platform's `evidence_items` table
is genuinely one-to-many (a control can accumulate evidence across
reassessment cycles), which is a real improvement over the source, not a
port of existing behavior.

## 10. Roadmap "Priority Score" is just the domain weight

Every row in the source Roadmap sheet shows Priority Score = its domain's
weight (every GV row: 0.16) regardless of the size of that row's actual
gap. It's not a computed prioritization — it's a copy of the domain
weight, dressed up as a priority column. If you want real gap-based
prioritization in the platform (recommended), that's new logic to design,
not something to port faithfully from the source.

## 11. NS-CMMF content that ended up hardcoded, and why

Per the brief's instruction to flag this explicitly:

- **`MANDATED_FLOOR_LEVEL = 3` and the standard→scoping-question map**
  (`lib/mandate-shortfall.ts`) are hardcoded TypeScript, not data. The
  source workbook never defines a "mandated floor" anywhere — no cell,
  formula, or comment states a minimum acceptable level per regulation. I
  used L3 ("Defined") because it's the default target level the workbook
  assigns to every control in the Acacia sample, but that's my inference,
  not sourced fact. **Different regulations plausibly warrant different
  floors** (PCI DSS's continuous-monitoring expectations arguably demand
  L4; CCPA's lighter-touch requirements might only need L2) — this needs
  Nucleus's compliance SMEs to define per-standard, not a platform
  default. Same for the family→question map: it's reference knowledge
  ("DORA" citations mean "check Q3"), not framework content, but it's
  still sitting in code rather than a table today because nothing in the
  source models it as data.
- **`is_foundational` is hardcoded `false` for every loaded control**,
  because no source field marks a control foundational. This means the
  `FOUNDATIONAL_ABSENCE` register trigger is fully implemented and
  unit-tested (`lib/__tests__/register.test.ts`) but **cannot fire on any
  real seeded data** — nobody has told the platform which of NS-CMMF's
  188 controls are foundational. That's a curation task for Nucleus's
  framework authors, not something derivable from the workbook.
- **The domain-weight-to-domain-code join in the loader is positional**
  (`scripts/frameworks/ns-cmmf.config.ts`: Dashboard rows 6–11 are
  assumed to be GV/ID/PR/DE/RS/RC in that exact order) rather than keyed
  by an explicit code in the Dashboard sheet itself, because the
  Dashboard doesn't carry domain codes — only emoji and full names. Load-
  bearing assumption; would break silently if a future framework's
  Dashboard sheet ordered domains differently from its domain-sheet tabs.

## 12. A 188-control questionnaire will exhaust any client — clustering is supported by the data, here's how

The data supports clustering along two axes that already exist as real
columns, not something to invent:

1. **By `Category`** — GV's 28 controls already fall into 6 named
   categories (Leadership & Strategy, Policy Framework, Risk Management,
   Third-Party & Supply Chain, Privacy & Compliance, Audit & Assurance),
   each a natural ~4-6 question cluster a single stakeholder (e.g. the
   DPO for Privacy & Compliance) could complete in one sitting, rather
   than one person facing all 28.
2. **By scoping dependency** — the 61 controls with `_SCOPE` flags are
   natural "only ask if relevant" clusters per regulation (the 9 controls
   flagged against Q20 "ICT third-party provider," for instance, are a
   single vendor-management cluster a client's procurement lead could
   answer in isolation).

The scale problem is real, though: PR (Protect) alone is 83 controls — 44%
of the whole framework — so category-clustering inside PR still leaves
large clusters. Full-188 rollout should test clustering granularity
against PR specifically, not GV (28 controls understates the fatigue
problem you're asking about by roughly 3x).

## 13. Cross-framework control mapping stays manual expert work

The schema holds it (`cross_framework_control_links`, self-referential
across `controls` regardless of framework), and the concrete test case in
the brief — NS-CMMF's AI controls (prompt injection prevention, AI model
access control, AI output monitoring, adversarial AI testing, AI literacy
training) overlapping NS-AISCA and NS-AIGF — is exactly the shape this
table is for. But populating it requires a human who understands both
frameworks' control intent well enough to judge "equivalent" vs
"overlaps" vs "supersedes," which is not automatable from the text alone
(two controls can have very different wording for the same underlying
requirement, or similar wording covering different scope). The table is
empty because there's only one framework loaded — it stays empty even
with two loaded, until someone does that judgment work.

## 14. Evidence quality tiering is human judgement, structurally acknowledged

`evidence_items.tier` (Tier 1–4) is a plain enum column an assessor sets;
there's no way to derive it from the artefact metadata alone (a
"document name" doesn't tell you whether it's Tier 1 automated tool output
or Tier 4 attestation-only). This mirrors the source workbook's own
instructions column verbatim: "Select the tier that matches the quality
of what you actually have. Do not select the tier you want."

## 15. Register modeling choices made in the absence of a fully specified state machine

The brief's prose ("promote when ANY of five conditions fire") and its
state-machine diagram (`deferred | accepted → registered` as a distinct
arrow) are in tension: the prose reads like MANDATE_SHORTFALL and
FOUNDATIONAL_ABSENCE can promote a gap on control facts alone, while the
diagram implies `registered` is a separate step after a decision. I
resolved this by:

- Making `computeRegisterTrigger` (`lib/register.ts`) evaluate all five
  conditions against any non-closed remediation item regardless of its
  current `lifecycleState` — so a control-fact trigger (mandate
  shortfall, foundational absence) or a time-based one (overdue) can
  surface a gap on the register even before an assessor has explicitly
  deferred or accepted it.
- Auto-cascading `deferred`/`accepted` straight to the `registered`
  lifecycle state in the same action (`lib/actions/improvement.ts`),
  logging both waypoints in `register_state_transitions`, so there's no
  separate manual "now register it" click for an assessor to forget.

This is a defensible reading, tested exhaustively (every trigger, every
priority-ordering combination, the closed-never-reopens rule), but it's
an interpretation, not a specification Nucleus signed off on. Worth a
product conversation before this goes further.

I also did not model "declined to remediate" vs "accepted a compensating
control that doesn't reach target" as separate structured reasons — both
collapse to `decision = 'accepted'` with the distinction living in the
free-text `decisionRationale`. That rationale field is compliant with "no
free-text entries" because it's always anchored to a real control gap and
never stands alone as an entry — but if Nucleus wants to report on "how
many gaps were accepted via compensating control" as a metric, that needs
its own field, not text-mining a rationale.

## 16. Reassessment and the delta view are untested by the source

Acacia's own "Assessment History" sheet — the one place a second
assessment cycle would show up — is entirely blank (`—` placeholders in
every data row). The source workbook has never actually been used for a
second cycle on the same client. So `startReassessment`'s pre-fill logic
and the delta view (`app/cycles/[cycleId]/delta`) are built from the
brief's description of the *intended* workflow, not validated against any
real multi-cycle data. They work correctly against the mechanics I could
verify (a new cycle number, scoping/response/rating carried forward,
re-resolution against possibly-changed scoping answers) — but there's no
source-of-truth second cycle to check the numbers against, unlike every
other page in this platform.

## 17. Does the schema honestly generalize past control-and-maturity-level frameworks?

Yes for the two abstractions that matter most: `maturity_scales` is a row
set (not an enum), so a 2-level readiness scale or a 3-tier operational
scale reuses the same table; `assessment_unit_singular/plural` on
`frameworks` means the UI can say "readiness criterion" instead of
"control" without a schema change.

Where I'd expect it to strain, honestly: a framework whose unit isn't
ordinal at all — a pure pass/fail architecture pattern, say — still fits
mechanically (a 2-level "scale": Fail/Pass), but "gap" and "score" as
concepts stop meaning anything real; you'd be computing `1 - 0 = 1` and
calling it a gap when what actually happened is "doesn't meet the
pattern." NS-AISCA (a controls *architecture*, per the brief) is the most
likely of the remaining nine to expose this — I'd load it second, not
last, specifically to stress-test this assumption before more of the
platform is built around "gap" as a universal concept.

## 18. Client form has a minor pre-existing data-quality wrinkle

The "blank" client template (`NS_CMMF_v1_Client_Assessment_Form_2026.xlsx`)
that's meant to ship with nothing filled in already has Yes/No answers on
its Scoping tab for Q1, Q2, Q3, Q10, Q11, Q12 (blank for the other 17).
Unclear whether this is an intentional worked example left in the
template or an authoring leftover — worth Nucleus checking before this
exact file goes to a real client, since a client might reasonably assume
those answers are theirs to keep rather than overwrite.

## 19. Tooling notes (not framework findings, but worth recording)

- `shadcn`'s CLI (`init`/`add`) calls out to `ui.shadcn.com`, which this
  environment's egress policy blocks. Every `components/ui/*` file here is
  hand-written against the same Radix primitives the CLI would have
  scaffolded — functionally equivalent, just not CLI-generated. Not a
  framework-model finding, but worth knowing if you regenerate components
  later expecting the CLI to work.
- `@tanstack/react-table`'s latest published major (v9) ships a
  completely different, undocumented-at-this-vintage API (no
  `useReactTable`/`getCoreRowModel`). Pinned to v8.21.3, the stable,
  documented line, for the rating grid.

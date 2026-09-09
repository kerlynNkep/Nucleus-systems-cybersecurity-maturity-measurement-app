# Nucleus Assessment Platform — NS-CMMF prototype

A maturity **evaluation and improvement management** platform, built to load
any of Nucleus Systems' ten proprietary assessment frameworks — with
NS-CMMF v1.0 (Cybersecurity Maturity Management Framework) as the only one
actually populated, on a thin slice of one domain (GV — Govern, 28
controls out of NS-CMMF's 188).

This is a working prototype meant to find out where the model breaks, not a
production system. Read **[SHORTFALLS.md](./SHORTFALLS.md)** for what it
found.

## Stack

Next.js 15 (App Router, React 19, Server Components, Server Actions) · TypeScript
strict · Drizzle ORM + PostgreSQL · Zod · Tailwind CSS v4 + hand-rolled
shadcn-style components (see below) · TanStack Table v8 · SheetJS (`xlsx`) ·
pnpm · Vitest.

**Why shadcn/ui components are hand-written instead of CLI-generated**: the
`shadcn` CLI's `init`/`add` commands fetch from `ui.shadcn.com`, which this
environment's network policy blocks. The components under `components/ui/`
are the same Radix-primitive-based components the CLI would generate —
written by hand, installing `@radix-ui/react-*` packages directly from npm
(which *is* reachable). Functionally identical; just not CLI-scaffolded.

## Prerequisites

- Node.js 22+, pnpm
- PostgreSQL 16 (a local `postgresql` service works fine for this prototype)

## Setup

```bash
pnpm install

# Point at your Postgres instance
cp .env.example .env
# edit .env if your DATABASE_URL differs from the default

# Create the schema (25 tables)
pnpm db:generate   # only needed if you change db/schema/*.ts
pnpm db:migrate

# Load the NS-CMMF framework definition from the reference workbook
# (frameworks, domains with weights, GV's 28 controls, maturity scale,
# 23 scoping questions + rules, level descriptions, recommendations,
# standard citations — all read from reference/NS_CMMF_Acacia_....xlsx)
pnpm loader:cmmf

# Seed a demo engagement for Acacia Financial Services Ltd, walked through
# every lifecycle stage using Acacia's real scoping answers, narratives and
# ratings from the same workbook
pnpm seed
```

The seed script prints the engagement, cycle, and client-link URLs at the
end — open them directly rather than clicking through engagement creation
again. The client questionnaire link is always
`/client/acacia-demo-token`.

```bash
pnpm dev
# → http://localhost:3000
```

## Tests

```bash
pnpm test
```

28 Vitest cases, all pulling their expected values directly from the source
workbook's own computed cells (not just internally-consistent assertions).
Two things are tested deliberately hard, per the brief:

- **Weighted rollup with excluded controls** (`lib/__tests__/scoring.test.ts`)
  — including the fact that NS-CMMF's domain weights sum to 0.87, not 1.0,
  and the rollup must normalize by that sum, not assume it's 1.
- **Register promotion triggers** (`lib/__tests__/register.test.ts`) —
  every one of the five triggers individually, the priority ordering when
  several fire on the same gap, and the mandate-shortfall standard-to-
  scoping-question mapping.

## How the pieces fit together

```
scripts/load-framework.ts   Framework DEFINITION only. Ingests frameworks,
  (run: loader:cmmf)        domains+weights, controls, maturity scale,
                             scoping questions/rules, level descriptions,
                             recommendations, standard citations. Re-running
                             it wipes and reloads that framework (idempotent,
                             but destroys any engagement data seeded on top —
                             it warns before doing so).

scripts/seed.ts              Engagement INSTANCE data for one demo client
  (run: seed)                (Acacia), walked through every lifecycle stage.
                             Reads the same workbook's Acacia-specific
                             columns (scoping answers, narratives, ratings,
                             roadmap entries) — never framework content. Not
                             idempotent — intended to run once against a
                             freshly-migrated + freshly-loaded database.

lib/scoring.ts                Pure functions: score/gap derivation, per-
                               domain and overall weighted rollup.
lib/register.ts                Pure function: the five promotion triggers,
                               priority ordering, register view assembly.
lib/mandate-shortfall.ts       Framework-specific glue the register engine
                               deliberately doesn't own: which standard maps
                               to which NS-CMMF scoping question, and what
                               floor level counts as "meeting" a mandate.
lib/queries.ts, lib/derived.ts Read-side DB access and the joins/enrichment
                               (level descriptions, recommendations,
                               citations, rollups, register) every page uses.
lib/actions/*.ts ("use server") Every state-changing operation: engagement
                               setup, scoping resolution, questionnaire
                               save/lock/amend, validation, rating,
                               improvement-plan edits and lifecycle
                               transitions, reassessment.
```

## What's genuinely out of scope for this prototype

Per the brief: real authentication (an assessor "session" is a free-text
name; the client link is a bearer token with no further auth), Board
Report/PDF export, real evidence file upload (evidence is metadata rows —
`document_name`, tier, dates — with no artefact storage), email delivery of
the client link (the URL is printed/displayed, never sent), and populating
the other nine frameworks or NS-CMMF's other five domains (160 of NS-CMMF's
188 controls exist only as rows the loader proves it *can* hold — see
SHORTFALLS.md for exactly what was and wasn't loaded).

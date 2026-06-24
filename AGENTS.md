# Agent Guidance

This workspace contains the finished TypeScript implementation plus the original generated visual reference.

This repo is standalone. It must not assume it lives inside, forks, vendors, or deploys from the Soofi, Elephant, or PRISM prompt repos. Keep those as explicit external GitHub references only.

## Commands

```bash
pnpm test
pnpm start
```

Open `http://127.0.0.1:4174/` after starting the server.

## Package Boundaries

- `apps/web`: React/Vite command center UI.
- `apps/api`: planned tRPC router names and procedures.
- `packages/domain`: canonical entities, result shapes, lifecycle states, evidence records.
- `packages/fixtures`: loads `oracle-data.js` and overlays parsed Soofi/Elephant source snapshots.
- `packages/team-kit-source`: generated source-backed Soofi agent/skill registry and reference repo metadata.
- `packages/retrieval`: required inquiry handlers, natural-language fallback, citations, details, graph construction.
- `packages/agent-registry`: registry lifecycle, reviewer decisions, certification history, evaluation outcomes, metrics, and marketplace gating.
- `packages/evidence-ledger`: run history, producer/evaluator/certifier provenance, citations, result keys, and run metrics.
- `packages/api-client`: in-process demo client used by the web app.

## Editing Rules

- Keep all 23 required Oracle README inquiry labels exact.
- Every required inquiry must return at least one result or the relationship graph.
- Keep `LEXICON.md` and `ORACLE_LEXICON_ENTITIES` / `ORACLE_LEXICON_RELATIONSHIPS` aligned when canonical entities or relationships change.
- Preserve source provenance on entities and evidence runs.
- Preserve the live `elephant-query-db` gate. `pnpm verify:live` must skip cleanly without `DATABASE_URL`; `pnpm verify:live:required` must fail without credentials and validate views, tables, row counts, and `source_payload` when credentials are present.
- A self-owned Vercel Postgres/Neon database is acceptable when it exposes the same PR #54 contract. Use `pnpm db:seed` or `pnpm db:seed:reset` to create/seed that surface before running `pnpm verify:live:required`.
- Preserve source-backed registry discovery. Do not replace `packages/team-kit-source/src/generated/reference-snapshot.json` with hand-authored agent data; regenerate it with `scripts/sync-reference-snapshots.js`.
- Preserve absolute external repo URLs for the assignment repos, `soofi-xyz/soofi-xyz-team-kit`, Soofi PR #54, and `elephant-xyz/skills`. Generated `docs`, `repo`, and `sourceRepo` fields must be full `https://github.com/...` URLs, not relative paths or bare `github.com/...` strings.
- Preserve the eight lifecycle statuses exactly: `Discovered`, `Registered`, `In Review`, `Changes Requested`, `Certified`, `Rejected`, `Deprecated`, `Suspended`.
- Preserve manual agent registration. `Register external` must add a non-GitHub agent with owner, capabilities, inputs, outputs, tools/data sources, and normal certification lifecycle actions.
- Preserve the governance behavior: `oracle` starts as `Discovered`, is hidden from Marketplace until certified, and Evidence records the certification state at run time.
- Treat `Oracle Command Center.dc.html` and `support.js` as the original generated design reference. Do not update them unless the user explicitly asks to change the reference artifact.

## Verification Expectations

Run `pnpm test` after changes. For UI changes, also exercise:

1. Intelligence inquiry -> detail pane.
2. Registry certification flow for `oracle`.
3. Manual `Register external` flow for a non-GitHub agent.
4. Marketplace visibility after certification.
5. Evidence ledger showing provisional and certified runs.

For registry/source changes, also run:

```bash
node scripts/sync-reference-snapshots.js
pnpm verify
```

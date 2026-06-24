# Oracle Command Center

## Assignment Evaluation Path

This PR completes the Oracle Property Intelligence Platform user story. Evaluate the hosted runtime from the `Intelligence` workflow:

- Runtime: https://oracle-command-center-nine.vercel.app/
- Demo: https://www.loom.com/share/b65506e580eb4101a812a42f9800a5f2
- Credentials: none required; the runtime is public.
- Original completed source commit: https://github.com/gillworks/prismteam/commit/db7e250cf139f47a3ee29ec2ad30745f1b92c92a
- Original completion timestamp: 2026-06-19 04:27:53 UTC

The commits in this PR are administrative packaging after Sean's follow-up request for PR-based submission. The original assignment prompt is preserved in `ASSIGNMENT.md`.

Integrated PRISM take-home build combining:

- Oracle Property Intelligence
- Agent Network registration and certification
- Certified-agent marketplace behavior
- Evidence and provenance ledger
- Fixture-first demo mode with live Vercel Postgres/Neon readiness

The app is designed to run immediately with deterministic Lee County-style fixtures, then switch to a live database on Vercel when `DATABASE_URL` and the Soofi/Elephant query contract are available.

## Repository Scope

This is a standalone submission repo. It is not a fork, submodule, workspace package, or deployment of any Soofi, Elephant, or PRISM repository. External repositories are referenced by explicit GitHub URLs and pinned snapshot metadata only.

## External References

Assignment prompts:

- Oracle Property Intelligence Platform: https://github.com/prismteam-ai/Oracle-Property-Intelligence-Platform
- Agent Network Registration & Certification Platform: https://github.com/prismteam-ai/agent-network-registration-and-certification-platform

Source and contract references:

- Soofi team kit: https://github.com/soofi-xyz/soofi-xyz-team-kit
- Soofi PR #54 `use-elephant-query-db`: https://github.com/soofi-xyz/soofi-xyz-team-kit/pull/54
- Elephant skills: https://github.com/elephant-xyz/skills

The app does not require Soofi production infrastructure. Your Vercel deployment can use your own Vercel Postgres/Neon database as long as it exposes the PR #54-compatible query contract.

## What This Demonstrates

- One cohesive command center instead of two disconnected portals.
- All 23 required Oracle demo inquiries in a drawer that launches the same RAG workflow as typed search.
- Server-side natural-language RAG through Neon `pgvector`, OpenAI embeddings, and OpenAI LLM synthesis.
- Source-backed Soofi team-kit discovery from parsed agents and skills.
- Visible Soofi network lineage for `arceus`, `oracle`, `espeon`, `alakazam`, `metagross`, and the Oracle query DB skills.
- Agent lifecycle: Discovered, Registered, In Review, Certified, Rejected, Deprecated, Suspended.
- Manual non-GitHub agent registration.
- Marketplace gating so only Certified agents are published.
- Evidence runs that record query, agent, evaluator, certifier, citations, source systems, and result keys.
- Server-only live data adapter for the PR #54 `use-elephant-query-db` surface.

## Quick Start

```bash
pnpm install
pnpm start
```

Open:

```text
http://127.0.0.1:4174/
```

If port `4174` is busy, Vite will print the next available localhost URL.

## Verify

```bash
pnpm test
```

This runs:

```bash
pnpm verify
pnpm typecheck
pnpm build
```

`pnpm verify` checks the acceptance-critical surface: fixture corpus size, all 23 required inquiries, Soofi/Elephant source snapshot coverage, PR #54 coverage, registry lifecycle, marketplace gating, manual registration, evidence ledger, Vercel metadata, and the live DB adapter contract.

## Vercel Deployment

The repo includes `vercel.json` for deploying the Vite app from `apps/web`.

Expected Vercel settings:

```text
Install Command: pnpm install --frozen-lockfile
Build Command: pnpm build
Output Directory: apps/web/dist
```

The browser app never receives database credentials. It boots from the static fixture client, then calls:

```text
/api/command-center
```

That Vercel function decides whether to use the live database or fixture fallback.

## Local Environment Files

Use `.env.example` as the template for local credentials:

```bash
cp .env.example .env
```

Then edit `.env` with your Neon `DATABASE_URL` and `OPENAI_API_KEY`. The `.env` file is ignored by git and should not be committed.

Node scripts do not load `.env` automatically. Either prefix variables inline, or run credentialed scripts through `dotenv-cli`:

```bash
pnpm dlx dotenv-cli -e .env -- pnpm db:seed:reset
pnpm dlx dotenv-cli -e .env -- pnpm verify:live:required
pnpm dlx dotenv-cli -e .env -- pnpm rag:seed
pnpm dlx dotenv-cli -e .env -- pnpm rag:verify:required
```

## Live Database Mode

No Soofi production credentials are required. To test with your own Vercel Postgres/Neon database, set:

```bash
ORACLE_DATA_SOURCE=elephant-query-db
DATABASE_URL="postgres://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

Then seed and verify your database:

```bash
pnpm dlx dotenv-cli -e .env -- pnpm db:seed:reset
pnpm dlx dotenv-cli -e .env -- pnpm verify:live:required
```

`pnpm db:seed:reset` creates the PR #54-compatible tables and views, then loads the demo corpus.

`pnpm verify:live:required` validates:

- Required views: `property_profile_view`, `permit_search_view`, `company_profile_view`, `address_profile_view`
- Required logical tables, including properties, parcels, ownerships, improvements, business registrations, BBB profiles, complaints, reviews, contractor quality scores, and addresses
- Required column names and compatible Postgres type families
- Non-empty property and permit row counts
- `source_payload jsonb` lineage columns on evidence-bearing tables

Without credentials, this command skips cleanly:

```bash
pnpm verify:live
```

If the live DB contract fails at runtime, the server reports the fallback reason and the UI continues in fixture mode instead of breaking.

## Natural-Language RAG Mode

Free-text natural-language search is server-only. It does not fall back to browser regex or keyword scoring. Configure a Neon/Postgres database with `pgvector` plus OpenAI credentials:

```bash
DATABASE_URL="postgres://USER:PASSWORD@HOST/DATABASE?sslmode=require"
OPENAI_API_KEY="sk-..."
ORACLE_RAG_ANSWER_MODEL="gpt-5.4-mini" # optional
ORACLE_RAG_EMBEDDING_MODEL="text-embedding-3-small" # optional
```

Seed and verify the vector index:

```bash
pnpm dlx dotenv-cli -e .env -- pnpm rag:seed
pnpm dlx dotenv-cli -e .env -- pnpm rag:verify:required
```

Without credentials, `pnpm rag:verify` skips cleanly. Structured filters and the initial fixture-backed view still work locally; typed RAG and required-prompt drawer launches require the server-side vector/LLM path for full answers.

## Demo Flow

1. Open `Intelligence`.
2. Open the Required Demo Inquiries drawer and launch prompts such as `Show all properties with open roofing permits`.
3. Ask free-text RAG questions such as `Which properties appear likely to be undergoing redevelopment?`.
4. Open result cards to inspect citations, entity details, and relationship lineage.
5. Open `Evidence` to see provisional runs while `oracle` is still `Discovered`.
6. Open `Registry`, select `oracle`, then move it through registration, review, and certification.
7. Use `Register external` to open the prefilled manual-registration form, review/edit owner, capabilities, inputs, outputs, tools, and data sources, then submit a non-GitHub agent.
8. Certify the external agent, then open `Marketplace` to confirm only Certified agents are published.
9. Run a new inquiry and return to `Evidence`; new runs are stamped with the certified state while older provisional runs remain unchanged.

## Project Structure

```text
apps/web                         React/Vite command center UI
apps/api                         tRPC routers and command-center HTTP runtime
api/command-center.ts            Vercel serverless entrypoint
packages/domain                  Shared entities, lifecycle states, evidence types
packages/fixtures                Deterministic Oracle fixture corpus
packages/retrieval               Required inquiries, stretch routing, detail views
packages/rag                     Server-only Neon pgvector and OpenAI RAG runtime
packages/agent-registry          Discovery, lifecycle, certification, marketplace gates
packages/evidence-ledger         Run provenance and metrics
packages/api-client              Static browser fallback client
packages/oracle-data-source      Server-only fixture/live DB adapter
packages/team-kit-source         Parsed Soofi and Elephant source snapshot
scripts/verify.js                Acceptance verifier
scripts/verify-live-query-db.js  Credentialed DB contract verifier
scripts/seed-contract-db.js      Vercel Postgres/Neon bootstrapper
scripts/seed-rag-index.js        Neon pgvector RAG index bootstrapper
scripts/verify-rag.js            Optional credentialed RAG verifier
```

## Reference Coverage

The checked-in source snapshot currently covers:

- 30 Soofi team-kit agents
- 39 Soofi team-kit skills
- Soofi PR #54 `use-elephant-query-db`
- 13 Elephant Oracle skills

To refresh snapshots after cloning newer upstream repos:

```bash
SOOFI_TEAM_KIT_PATH=/path/to/soofi-xyz-team-kit \
ELEPHANT_SKILLS_PATH=/path/to/elephant-xyz-skills \
node scripts/sync-reference-snapshots.js
```

## Important Files

- `ARCHITECTURE.md` explains fixture/live boundaries, evidence, registry state, and adapter swaps.
- `LEXICON.md` documents canonical Oracle entities and relationships.
- `AGENTS.md` captures repo operating notes for future agent work.
- `packages/oracle-data-source/README.md` documents the live DB contract in more detail.

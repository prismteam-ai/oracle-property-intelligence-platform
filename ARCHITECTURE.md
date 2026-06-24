# Architecture

## Product Shape

Oracle Command Center is one integrated app with four modes:

- `Intelligence`: Oracle property exploration with deterministic required inquiry execution and server-side natural-language RAG.
- `Registry`: Soofi agent discovery, manual agent registration, metadata registration, review, certification, and branch states.
- `Marketplace`: publishable catalog that only lists certified agents.
- `Evidence`: run ledger showing query, result count, cited source systems, responsible agent, and certification state at execution time.

The core story is agentic layering: Oracle results are useful before certification but marked provisional; after the registry certifies `oracle`, new intelligence runs are stamped as certified and the agent becomes marketplace-visible.

## Repository Boundary

This codebase is a standalone PRISM submission repo. It does not vendor, fork, submodule, or deploy from `soofi-xyz/soofi-xyz-team-kit`, `elephant-xyz/skills`, or the two `prismteam-ai` prompt repositories.

External repos are used as references:

- `https://github.com/prismteam-ai/Oracle-Property-Intelligence-Platform` and `https://github.com/prismteam-ai/agent-network-registration-and-certification-platform` define the assignment goals.
- `https://github.com/soofi-xyz/soofi-xyz-team-kit` supplies source snapshot metadata for agent and skill discovery.
- `https://github.com/soofi-xyz/soofi-xyz-team-kit/pull/54` supplies the `use-elephant-query-db` contract reference.
- `https://github.com/elephant-xyz/skills` supplies Oracle ingestion skill references.

The generated snapshot stores upstream repo URLs, source paths, and commits so reviewers can trace provenance without requiring those repos to exist inside this workspace.

## Data Boundary

The current implementation is mixed fixture/source-backed by design:

- Oracle property intelligence is static-first. `oracle-data.js` exposes a deterministic Lee County-style corpus with properties, permits, owners, tenants, businesses, contractors, BBB complaints, source URLs, collection timestamps, and refresh timestamps.
- The browser starts with the in-process fixture client, then calls `/api/command-center`. That server action selects live Elephant Query DB only when `ORACLE_DATA_SOURCE=elephant-query-db`, `DATABASE_URL` is present, and the schema contract passes. Otherwise it returns the same fixture corpus with a visible fallback reason.
- `packages/oracle-data-source` defines the server-only `OracleDataSource` boundary. Default mode returns the fixture corpus. `ORACLE_DATA_SOURCE=elephant-query-db` uses `DATABASE_URL` and `@neondatabase/serverless` against PR #54's `property_profile_view`, `permit_search_view`, `company_profile_view`, `business_reputation_profiles`, and `ownerships` query surface.
- `scripts/seed-contract-db.js` can create and seed that same PR #54 contract in a Vercel Postgres/Neon database owned by the demo operator. This avoids any dependency on Soofi production credentials while preserving the expected schema, views, row counts, and `source_payload` lineage columns.
- `scripts/verify-live-query-db.js` is the credentialed live-data gate. With `DATABASE_URL`, it validates PR #54 views, logical tables, required column names/types, primary row counts, and `source_payload` lineage columns. Without `DATABASE_URL`, it reports a skipped check unless run with `--required`.
- The canonical Elephant Lexicon is defined in `packages/domain/src/index.ts` and documented in `LEXICON.md`. It covers Properties, Owners, Tenants, Businesses, Contractors, Permits, Addresses, Parcels, Projects, Reviews, Complaints, Public Records, durable IDs, provenance fields, and relationship evidence.
- Agent discovery is source-backed. `scripts/sync-reference-snapshots.js` parses `soofi-xyz/soofi-xyz-team-kit` from `agents/*.md`, `skills/*/SKILL.md`, and `plugin.json`, records the upstream commit, records PR #54's `use-elephant-query-db` coverage, and parses `elephant-xyz/skills`.
- `packages/team-kit-source` exposes the generated source snapshot to the app. `packages/fixtures` overlays those parsed agents and source snapshots onto the Oracle corpus.
- `packages/evidence-ledger` creates deterministic run history from the inquiry layer and registry state. Each run records the producing agent, evaluator, certifier when certified, citations, source systems, and result keys.
- `packages/rag` is the server-only natural-language path. It builds canonical Oracle RAG documents, stores embeddings in Neon `pgvector`, retrieves with cosine similarity, and asks OpenAI to synthesize an answer only from retrieved evidence.
- Manual registration is first-class. `packages/agent-registry` can register operator-submitted agents that did not come from GitHub scanning, captures owner/capability/input/output/tool/data-source metadata, and keeps those agents out of the marketplace until certification.

Free-text RAG requires `DATABASE_URL`, `OPENAI_API_KEY`, and a seeded `oracle_rag_documents` table. Missing credentials or an empty vector table return a typed RAG-unavailable result. Required inquiry chips, structured filters, registry workflows, marketplace gates, and evidence history remain executable without those credentials.

## Runtime And Packages

The finished app is a Vite/React workspace:

- `apps/web` renders the command center and uses a runtime client that prefers `/api/command-center`, then falls back to the local API client.
- `apps/api` defines the tRPC routers and the command-center HTTP action handler: property, intelligence, registry, certification, marketplace, evidence, dashboard, and runtime fixture/live selection.
- `packages/domain` contains canonical types and lifecycle constants.
- `packages/oracle-data-source` owns fixture/live data-source selection and the Elephant Query DB coverage/projection adapter.
- `packages/retrieval` implements exact required inquiries, structured lexicon filters, citations, details, graph assembly, and the legacy deterministic stretch router used only as package-level fallback logic.
- `packages/rag` implements Neon `pgvector` retrieval, OpenAI `text-embedding-3-small` embeddings, OpenAI Responses API synthesis, canonical RAG document generation, and typed unavailable/error results.
- `packages/team-kit-source` contains source-backed registry data generated from Soofi/Elephant repositories.
- `packages/agent-registry` implements lifecycle transitions, manual registration, certification history, reviewer decisions, evaluation outcomes, registry metrics, usage/network participation metrics, and marketplace eligibility.
- `packages/evidence-ledger` implements evidence run creation and network run metrics used by both `apps/web` and `apps/api`.
- `packages/api-client` composes those packages into the in-process demo client and static browser fallback.

`Oracle Command Center.dc.html` and `support.js` remain as the original generated visual reference, not the primary app.

The API keeps registry state, evidence runs, and manually registered agent overlays in process for the demo server, exposing registry state, lifecycle mutations, certification history, marketplace eligibility, dashboard metrics, and the command-center runtime action contract. A production swap would replace that in-memory state with a durable store without changing the router contract.

Verification is handled by `scripts/verify.js`, which loads `oracle-data.js`, overlays the generated reference snapshot, and checks the acceptance-critical corpus, source-backed agent discovery, manual agent registration, PR #54 coverage, Elephant skill coverage, evidence ledger coverage, RAG document generation, registry history coverage, governance invariants, Vercel deployment metadata, and the self-owned database bootstrap path. `pnpm test` runs verifier, typecheck, and production build. `pnpm verify:live:required` is the separate credentialed gate for a contract-compatible Neon database, and `pnpm rag:verify:required` is the separate credentialed gate for the pgvector/OpenAI RAG path.

## Live Adapter Swap

The fixture model maps cleanly to live adapters:

- Keep the static browser fallback and point `/api/command-center` at an `OracleDataSource` backed by Elephant Query DB.
- Set `ORACLE_DATA_SOURCE=elephant-query-db` and provide a Vercel Postgres/Neon `DATABASE_URL`.
- For self-owned infrastructure, run `pnpm dlx dotenv-cli -e .env -- pnpm db:seed:reset` to create the PR #54 tables/views and seed source-backed demo rows, then run `pnpm dlx dotenv-cli -e .env -- pnpm verify:live:required`.
- If a target database is missing a table, view, required column, compatible type, row count, or `source_payload`, the server reports the failure and serves fixtures instead of breaking the UI.
- Run `pnpm dlx dotenv-cli -e .env -- pnpm rag:seed` to create `oracle_rag_documents`, enable `pgvector`, embed canonical Oracle chunks, and make free-text natural-language RAG available.
- A future production swap can replace Neon/OpenAI RAG with Bedrock embeddings and OpenSearch hybrid retrieval without changing the `InquiryResult.retrieval` or `EvidenceRun.retrieval` metadata shape.
- Replace in-memory registry lifecycle state with a persistent `CertificationStore`.
- Keep evidence records immutable so certification state is captured at execution time rather than overwritten later.

Out of scope for this prototype: custom county scraping, IPFS publishing, blockchain indexing, MCP implementation, NEO rewiring, and Elephant.xyz UI changes.

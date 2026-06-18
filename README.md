# Oracle — Property Intelligence Platform

> RAG-backed exploration of Lee County, FL property, permit, business, and contractor records — modeled on the **Elephant Lexicon**, with full source provenance and natural-language querying.

A unified intelligence platform that ingests the Oracle-collected public datasets (property appraiser, permits, Sunbiz, BBB), reconciles them into the canonical Elephant Lexicon entity model, stores everything in a RAG-accessible knowledge layer, and exposes it through exploration interfaces for **Properties, Tenants, Businesses, and Contractors** plus a natural-language **"Ask Oracle"** interface that returns source-cited answers.

The original milestone brief is preserved in [`SPEC.md`](./SPEC.md).

---

## Quickstart

```bash
docker compose up --build
# → http://localhost:8080   (seeds ~2,200 properties / ~14,600 permits / 3,400 embedded docs on first boot)
```

The stack is four services: Postgres + pgvector, a local embeddings service (fastembed / `bge-small`, 384-dim — no external API), a one-shot **seeder**, and the Next.js web app. First boot generates the dataset, loads it, and builds the vector index (~1–2 min), then serves.

### Local dev (without Docker)
```bash
npm install
# Postgres 16 + pgvector reachable at $DATABASE_URL, embeddings service at $EMBEDDINGS_URL
echo "DATABASE_URL=postgres://user:pass@localhost:5432/oracle" > .env.local
echo "EMBEDDINGS_URL=http://localhost:8900" >> .env.local
npm run db:push                                         # create schema
node --env-file=.env.local --import tsx src/db/load.ts  # generate + load dataset
node --env-file=.env.local --import tsx src/db/embed.ts # build embeddings + HNSW index
npm run dev                                             # http://localhost:3000
```

---

## What's inside

| Area | Highlights |
|---|---|
| **Property View** | ownership history, full permit history, open permits, contractor activity, business occupancy & tenants, major improvement activity, sales/deeds, and a property relationship graph |
| **Tenant View** | occupancy history, tenant→property relationships, the legal business entity behind the tenant, and associated permits/projects |
| **Business View** | Sunbiz registration, officers/registered agent, locations, related properties, related permits |
| **Contractor View** | BBB rating & reputation score, complaints, reviews, project & permit history, work-mix, and contractor→property relationships |
| **Ask Oracle (RAG)** | NL questions → a **structured router** (22 analytical inquiries answered with exact SQL) + **hybrid semantic search** (pgvector cosine fused with Postgres full-text). Every answer is source-cited. |
| **Insights & Signals** | every required demo inquiry computed live, plus stretch signals (redevelopment/acquisition candidates, value-add, neighborhood trends) |
| **Data & Provenance** | per-source refresh ledger, lexicon entity coverage, and the citation model |

## Architecture

```
Next.js 15 (App Router, RSC) ──► Postgres 16 + pgvector ◄── seeder (Drizzle schema + dataset + embeddings)
        │                              ▲
        └── RAG engine ────────────────┘
              ├─ structured router  (NL → SQL inquiry, fully cited)
              └─ hybrid retrieval   (bge-small 384d vectors  ⊕  tsvector FTS) ──► local embeddings service
```

- **Canonical model (Elephant Lexicon).** `parcels, properties, addresses, people, companies, ownerships, sales_histories, property_improvements (permits), inspections, permit_contacts, business_registrations (+ parties), business_reputation_profiles (BBB) + complaints/reviews, contractor_quality_scores`, plus extensions `occupancies` (tenant/occupancy) and `entity_documents` (the RAG index). See [`src/db/schema.ts`](./src/db/schema.ts).
- **Provenance everywhere.** Every source-derived row carries `source_system`, `source_record_key`, `source_url`, `retrieved_at`, `loaded_at`. RAG answers cite back to the originating public record (appraiser / Accela / Sunbiz / BBB).
- **MCP / NEO ready.** The data model and query layer are agent-consumable as-is; no schema changes are required to expose this over MCP later.

## Demo inquiries

All **Required Demo Inquiries** from the brief are answerable in **Ask Oracle** and visible on **Insights** — e.g. *properties with more than one open permit*, *open roofing/electrical permits*, *major concrete/roof/electrical work*, *highest permit activity (5y)*, *contractors with negative BBB ratings / complaint histories*, *projects completed by those contractors*, *owners/businesses/tenants spanning multiple properties*, *ownership change + active permits*, *neighborhood permit trends*, plus stretch signals (redevelopment/acquisition candidates).

## Data note

This build runs on a **representative Lee County dataset** generated to the exact lexicon shape (real municipalities, ZIPs, STRAP parcel format, Accela/leepa/Sunbiz/BBB URL patterns). In production the identical model is populated by the Oracle ingestion pipeline (`oracle-node` + `elephant-xyz/skills`) into the Neon query DB — the app reads the same schema either way.

## Stack
Next.js 15 · React 19 · TypeScript · Tailwind v4 · Postgres 16 + pgvector · Drizzle ORM · fastembed (bge-small) · Recharts.

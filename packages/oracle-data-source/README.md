# Oracle Data Source

Server-side Oracle data boundary.

## Modes

- `fixture`: default. Returns the deterministic Lee County corpus so the demo runs without credentials.
- `elephant-query-db`: uses the PR #54 query surface through a Vercel Postgres/Neon `DATABASE_URL`. This can point at your own database; it does not require Soofi production access.

## Contract

The live adapter is intentionally server-only. It uses `@neondatabase/serverless` and the PR #54 logical query surface:

- `property_profile_view`
- `permit_search_view`
- `company_profile_view`
- `address_profile_view`
- `properties`
- `parcels`
- `ownerships`
- `property_improvements`
- `business_registrations`
- `business_reputation_profiles`
- `business_reputation_complaints`
- `business_reputation_reviews`
- `contractor_quality_scores`
- `addresses`

It also validates that `source_payload` is present on the primary evidence tables:

- `properties`
- `property_improvements`
- `business_registrations`
- `business_reputation_profiles`
- `business_reputation_complaints`
- `contractor_quality_scores`

Readiness also verifies the required columns and compatible Postgres type families used by the adapter. Examples include `property_profile_view.property_id`, `property_profile_view.property_structure_built_year`, `permit_search_view.contractor_company_id`, `company_profile_view.document_number`, and `business_reputation_profiles.review_average_rating`.

The web app must not import this package. Use it from `apps/api` or another trusted server runtime.

## Live Verification

Without credentials, live verification exits successfully as a skipped check:

```bash
pnpm verify:live
```

To require the live database, provide `DATABASE_URL` from a contract-compatible Vercel Postgres/Neon database:

```bash
DATABASE_URL="..." pnpm verify:live:required
```

The required command fails if any PR #54 view/table is missing, if a required column/type does not match the contract, if primary row counts are empty, or if expected `source_payload` lineage columns are absent.

## Own Vercel Database

To create a compatible demo database in your own Vercel account:

```bash
DATABASE_URL="..." pnpm db:seed:reset
DATABASE_URL="..." pnpm verify:live:required
```

The seed script creates the contract tables, adds `source_payload` columns, creates the four primary views, and loads the deterministic Oracle corpus. Use `pnpm db:seed` when you want upserts without truncation.

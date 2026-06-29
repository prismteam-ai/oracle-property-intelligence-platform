import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config. Points at the canonical lexicon schema (mirrors
 * @elephant-xyz/query-db) plus the additive namespaced tables. `db:push`
 * applies these to the local pgvector Postgres; the same schema objects are
 * what the Neon provider queries (the swap seam in src/server/db.ts).
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://oracle:oracle@localhost:5432/oracle",
  },
  verbose: true,
  strict: true,
});

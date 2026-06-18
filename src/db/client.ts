import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Fall back to a placeholder so the build can statically analyze modules without
// a live DB (all DB-reading pages are force-dynamic and only connect at runtime).
const url = process.env.DATABASE_URL || "postgres://localhost:5432/postgres";

// Reuse the client across hot-reloads in dev to avoid exhausting connections.
const globalForDb = globalThis as unknown as {
  __oracleSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.__oracleSql ?? postgres(url, { max: 12, prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.__oracleSql = sql;

export const db = drizzle(sql, { schema });
export type DB = typeof db;

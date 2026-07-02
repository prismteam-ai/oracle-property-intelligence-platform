import "server-only";

import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Pool as NeonPool } from "@neondatabase/serverless";

import * as schema from "@/db/schema";
import { runWithTransientRetry } from "./pg-retry";

const DATA_SOURCE = (process.env.DATA_SOURCE ?? "local").toLowerCase();

function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url.replace(/^postgres(ql)?:\/\//, "https://")).hostname;
    return host.endsWith(".neon.tech") || host.includes("neon");
  } catch {
    return false;
  }
}

export type Database =
  | ReturnType<typeof drizzleNeon>
  | ReturnType<typeof drizzleNodePg>;

type QueryablePool = { query: (...args: unknown[]) => unknown };

function withQueryRetry<P extends QueryablePool>(pool: P): P {
  const original = pool.query.bind(pool);
  pool.query = ((...args: unknown[]) => {
    const hasCallback = typeof args[args.length - 1] === "function";
    if (hasCallback) return original(...args);
    return runWithTransientRetry(() => original(...args) as Promise<unknown>);
  }) as P["query"];
  return pool;
}

function createDb(): Database {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error(
      `[oracle] DATABASE_URL is required when DATA_SOURCE=${DATA_SOURCE} ` +
        `(real Postgres). Refusing to serve without a database — set DATABASE_URL, ` +
        `or use DATA_SOURCE=memory for the DB-free in-memory dataset (tests/dev only). ` +
        `No silent in-memory fallback.`,
    );
  }
  if (DATA_SOURCE === "neon" || isNeonUrl(DATABASE_URL)) {
    const pool = withQueryRetry(new NeonPool({ connectionString: DATABASE_URL }));
    return drizzleNeon(pool, { schema });
  }
  const pool = withQueryRetry(new Pool({ connectionString: DATABASE_URL }));
  return drizzleNodePg(pool, { schema });
}

const globalForDb = globalThis as unknown as { __oracleDb?: Database };

function getDb(): Database {
  const existing = globalForDb.__oracleDb;
  if (existing) return existing;
  const created = createDb();
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__oracleDb = created;
  }
  return created;
}

export const db: Database = new Proxy({} as Database, {
  get(_t, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
}) as Database;

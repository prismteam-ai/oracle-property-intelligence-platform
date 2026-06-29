import { sql } from "drizzle-orm";

import { db } from "@/server/pg";

export async function ensureExtensions(): Promise<void> {
  await db.execute(sql`create extension if not exists vector`);
  await db.execute(sql`create extension if not exists pg_trgm`);
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("migrate.ts");
if (isMain) {
  ensureExtensions()
    .then(() => {
      console.log("Extensions ensured (vector, pg_trgm). Run `pnpm db:push` to sync schema.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migrate failed:", err);
      process.exit(1);
    });
}

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

import * as schema from "@/db/schema";

import { loadLocalEnv } from "./env";

async function run(): Promise<void> {
  loadLocalEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL required");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  try {
    const tables = [
      "properties",
      "parcels",
      "ownerships",
      "taxes",
      "sales_histories",
      "property_improvements",
      "addresses",
      "companies",
      "people",
      "public_records",
      "property_signal_rollups",
      "projects",
    ];
    for (const t of tables) {
      const r = await db.execute<{ n: number }>(sql.raw(`select count(*)::int as n from ${t}`));
      const rows = (r as unknown as { rows?: Array<{ n: number }> }).rows ?? (r as unknown as Array<{ n: number }>);
      console.log(`count ${t} = ${rows[0]?.n}`);
    }
    const size = await db.execute<{ mb: string }>(
      sql`select (pg_database_size(current_database())/1024.0/1024.0)::numeric(12,1)::text as mb`,
    );
    const srows = (size as unknown as { rows?: Array<{ mb: string }> }).rows ?? (size as unknown as Array<{ mb: string }>);
    console.log(`db size = ${srows[0]?.mb} MB`);
  } finally {
    await pool.end();
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

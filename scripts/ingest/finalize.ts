import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

import * as schema from "@/db/schema";
import {
  projectMaterializationSelect,
  publicRecordsMaterializationSelect,
  rollupMaterializationSelect,
} from "@/server/providers/neon-materialize-sql";

import { loadLocalEnv } from "./env";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const VACUUM_TABLES = [
  "addresses",
  "companies",
  "people",
  "properties",
  "parcels",
  "ownerships",
  "taxes",
  "sales_histories",
  "property_improvements",
  "property_signal_rollups",
  "projects",
  "public_records",
  "entity_documents",
];

function rowsOf(r: unknown): Array<Record<string, unknown>> {
  return (r as { rows?: Array<Record<string, unknown>> }).rows ?? (r as Array<Record<string, unknown>>);
}

async function rebuildMaterializations(db: Db): Promise<void> {
  console.log("[materialize] rebuilding rollups, projects, public_records from real data");
  await db.execute(sql`delete from property_signal_rollups`);
  await db.execute(sql`delete from projects`);
  await db.execute(sql`delete from public_records where entity_type in ('property', 'permit')`);
  await db.execute(sql`insert into property_signal_rollups ${rollupMaterializationSelect()} on conflict (source_system, source_record_key) do nothing`);
  await db.execute(sql`insert into projects ${projectMaterializationSelect()} on conflict (source_system, source_record_key) do nothing`);
  await db.execute(sql`insert into public_records ${publicRecordsMaterializationSelect(false)} on conflict (source_system, source_record_key) do nothing`);
  const rollups = await db.execute(sql`select count(*)::int as n from property_signal_rollups`);
  const projectsCount = await db.execute(sql`select count(*)::int as n from projects`);
  const records = await db.execute(sql`select count(*)::int as n from public_records`);
  console.log(
    `[materialize] rollups=${rowsOf(rollups)[0]?.n}, projects=${rowsOf(projectsCount)[0]?.n}, ` +
      `public_records=${rowsOf(records)[0]?.n}`,
  );
}

async function vacuumLoadedTables(db: Db): Promise<void> {
  for (const table of VACUUM_TABLES) {
    console.log(`[vacuum] ${table}`);
    await db.execute(sql.raw(`vacuum (analyze) ${table}`));
  }
}

async function integrityCheck(db: Db): Promise<void> {
  const checks: Array<{ label: string; query: string }> = [
    { label: "properties.parcel_id -> parcels", query: "select count(*)::int as n from properties p left join parcels x on x.parcel_id = p.parcel_id where p.parcel_id is not null and x.parcel_id is null" },
    { label: "properties.address_id -> addresses", query: "select count(*)::int as n from properties p left join addresses x on x.address_id = p.address_id where p.address_id is not null and x.address_id is null" },
    { label: "ownerships.property_id -> properties", query: "select count(*)::int as n from ownerships o left join properties x on x.property_id = o.property_id where o.property_id is not null and x.property_id is null" },
    { label: "ownerships.owner_person_id -> people", query: "select count(*)::int as n from ownerships o left join people x on x.person_id = o.owner_person_id where o.owner_person_id is not null and x.person_id is null" },
    { label: "ownerships.owner_company_id -> companies", query: "select count(*)::int as n from ownerships o left join companies x on x.company_id = o.owner_company_id where o.owner_company_id is not null and x.company_id is null" },
    { label: "taxes.property_id -> properties", query: "select count(*)::int as n from taxes t left join properties x on x.property_id = t.property_id where t.property_id is not null and x.property_id is null" },
    { label: "sales_histories.property_id -> properties", query: "select count(*)::int as n from sales_histories s left join properties x on x.property_id = s.property_id where s.property_id is not null and x.property_id is null" },
    { label: "property_improvements.property_id -> properties", query: "select count(*)::int as n from property_improvements pi left join properties x on x.property_id = pi.property_id where pi.property_id is not null and x.property_id is null" },
    { label: "property_signal_rollups.property_id -> properties", query: "select count(*)::int as n from property_signal_rollups r left join properties x on x.property_id = r.property_id where r.property_id is not null and x.property_id is null" },
    { label: "projects.property_id -> properties", query: "select count(*)::int as n from projects pr left join properties x on x.property_id = pr.property_id where pr.property_id is not null and x.property_id is null" },
  ];
  let totalOrphans = 0;
  for (const check of checks) {
    const r = await db.execute(sql.raw(check.query));
    const n = (rowsOf(r)[0]?.n as number) ?? 0;
    totalOrphans += n;
    console.log(`[integrity] ${check.label}: ${n} orphans`);
  }
  console.log(`[integrity] total orphans = ${totalOrphans}`);
}

async function run(): Promise<void> {
  loadLocalEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL required");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  try {
    await rebuildMaterializations(db);
    await vacuumLoadedTables(db);
    await integrityCheck(db);
    const size = await db.execute(sql`select (pg_database_size(current_database())/1024.0/1024.0)::numeric(12,1)::text as mb`);
    console.log(`[finalize] DONE; db size ${rowsOf(size)[0]?.mb} MB`);
  } finally {
    await pool.end();
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error("[finalize] failed:", e); process.exit(1); });

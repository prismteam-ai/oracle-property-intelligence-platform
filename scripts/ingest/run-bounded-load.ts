import { createInterface } from "node:readline";
import { createReadStream, existsSync } from "node:fs";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

import {
  addresses,
  companies,
  ownerships,
  parcels,
  people,
  properties,
  propertyImprovements,
  salesHistories,
  taxes,
} from "@/db/schema";
import * as schema from "@/db/schema";
import type {
  NewAddress,
  NewCompany,
  NewOwnership,
  NewParcel,
  NewPerson,
  NewProperty,
  NewPropertyImprovement,
  NewSalesHistory,
  NewTax,
} from "@/db/schema/types";

import { loadLocalEnv } from "./env";
import { LEEPA_SOURCE_SYSTEM, type LeepaParcelAttributes } from "./leepa-source";
import { normalizeParcel } from "./normalize";
import { STAGING_PATH } from "./parcels";
import {
  projectMaterializationSelect,
  publicRecordsMaterializationSelect,
  rollupMaterializationSelect,
} from "@/server/providers/neon-materialize-sql";

const INSERT_BATCH = 1000;
const PARCELS_PER_FLUSH = 4000;
const UPGRADE_CONFIRM_BYTES = 512 * 1024 * 1024;

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function isThrottleError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /throttle_or_fail_extension|pagestore|exceeds.*size|storage limit/i.test(message);
}

function isRichParcel(a: LeepaParcelAttributes): boolean {
  const hasOwner = typeof a.O_NAME === "string" && a.O_NAME.trim().length > 0;
  const hasBuilding = (a.BLDGCOUNT ?? 0) > 0;
  const hasValue = (a.JUST ?? 0) > 0;
  return hasOwner && (hasBuilding || hasValue);
}

type Totals = {
  addresses: number;
  people: number;
  companies: number;
  parcels: number;
  properties: number;
  ownerships: number;
  taxes: number;
  sales_histories: number;
  property_improvements: number;
};

type Window = {
  parcels: NewParcel[];
  addresses: Map<string, NewAddress>;
  people: NewPerson[];
  companies: NewCompany[];
  properties: NewProperty[];
  ownerships: NewOwnership[];
  taxes: NewTax[];
  sales: NewSalesHistory[];
  improvements: NewPropertyImprovement[];
};

function emptyWindow(): Window {
  return {
    parcels: [],
    addresses: new Map(),
    people: [],
    companies: [],
    properties: [],
    ownerships: [],
    taxes: [],
    sales: [],
    improvements: [],
  };
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

async function databaseSizeBytes(db: Db): Promise<number> {
  const result = await db.execute<{ bytes: string }>(
    sql`select pg_database_size(current_database())::bigint as bytes`,
  );
  const rows =
    (result as unknown as { rows?: Array<{ bytes: string }> }).rows ??
    (result as unknown as Array<{ bytes: string }>);
  return Number(rows[0]?.bytes ?? 0);
}

async function insertChunked(
  db: Db,
  table: Parameters<Db["insert"]>[0],
  rows: readonly Record<string, unknown>[],
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH);
    if (batch.length === 0) continue;
    await db.insert(table).values(batch).onConflictDoNothing();
    inserted += batch.length;
  }
  return inserted;
}

async function flushWindow(db: Db, window: Window, totals: Totals): Promise<void> {
  totals.addresses += await insertChunked(db, addresses, [...window.addresses.values()]);
  totals.people += await insertChunked(db, people, window.people);
  totals.companies += await insertChunked(db, companies, window.companies);
  totals.parcels += await insertChunked(db, parcels, window.parcels);
  totals.properties += await insertChunked(db, properties, window.properties);
  totals.ownerships += await insertChunked(db, ownerships, window.ownerships);
  totals.taxes += await insertChunked(db, taxes, window.taxes);
  totals.sales_histories += await insertChunked(db, salesHistories, window.sales);
  totals.property_improvements += await insertChunked(db, propertyImprovements, window.improvements);
}

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

async function vacuumLoadedTables(db: Db): Promise<void> {
  for (const table of VACUUM_TABLES) {
    await db.execute(sql.raw(`vacuum (analyze) ${table}`));
  }
}

async function rebuildMaterializations(db: Db): Promise<void> {
  console.log("[materialize] rebuilding rollups, projects, public_records from real data");
  await db.execute(sql`delete from property_signal_rollups`);
  await db.execute(sql`delete from projects`);
  await db.execute(sql`delete from public_records where entity_type in ('property', 'permit')`);
  await db.execute(sql`insert into property_signal_rollups ${rollupMaterializationSelect()} on conflict (source_system, source_record_key) do nothing`);
  await db.execute(sql`insert into projects ${projectMaterializationSelect()} on conflict (source_system, source_record_key) do nothing`);
  await db.execute(sql`insert into public_records ${publicRecordsMaterializationSelect(false)} on conflict (source_system, source_record_key) do nothing`);
  const rollups = await db.execute<{ n: number }>(sql`select count(*)::int as n from property_signal_rollups`);
  const projectsCount = await db.execute<{ n: number }>(sql`select count(*)::int as n from projects`);
  const records = await db.execute<{ n: number }>(sql`select count(*)::int as n from public_records`);
  const rows = (r: unknown) =>
    (r as { rows?: Array<{ n: number }> }).rows ?? (r as Array<{ n: number }>);
  console.log(
    `[materialize] rollups=${rows(rollups)[0]?.n}, projects=${rows(projectsCount)[0]?.n}, ` +
      `public_records=${rows(records)[0]?.n}`,
  );
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
    const r = await db.execute<{ n: number }>(sql.raw(check.query));
    const rows = (r as unknown as { rows?: Array<{ n: number }> }).rows ?? (r as unknown as Array<{ n: number }>);
    const n = rows[0]?.n ?? 0;
    totalOrphans += n;
    console.log(`[integrity] ${check.label}: ${n} orphans`);
  }
  console.log(`[integrity] total orphans = ${totalOrphans}`);
}

async function run(): Promise<void> {
  loadLocalEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("[load] DATABASE_URL is required; refusing to run without a database");
  }
  if (!existsSync(STAGING_PATH)) {
    throw new Error(`[load] staging file missing at ${STAGING_PATH}`);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    const totals: Totals = {
      addresses: 0,
      people: 0,
      companies: 0,
      parcels: 0,
      properties: 0,
      ownerships: 0,
      taxes: 0,
      sales_histories: 0,
      property_improvements: 0,
    };

    const reader = createInterface({
      input: createReadStream(STAGING_PATH, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    let window = emptyWindow();
    let read = 0;
    let pending = 0;
    let skipped = 0;
    let upgradeConfirmed = false;

    for await (const line of reader) {
      if (line.trim().length === 0) continue;
      read += 1;
      const attributes = JSON.parse(line) as LeepaParcelAttributes;
      if (!isRichParcel(attributes)) {
        skipped += 1;
        continue;
      }
      const normalized = normalizeParcel(attributes);
      if (!normalized) {
        skipped += 1;
        continue;
      }

      window.parcels.push(normalized.parcel);
      window.properties.push(normalized.property);
      window.ownerships.push(normalized.ownership);
      if (normalized.siteAddress) {
        window.addresses.set(normalized.siteAddress.addressId!, normalized.siteAddress);
      }
      if (normalized.ownerPerson) window.people.push(normalized.ownerPerson);
      if (normalized.ownerCompany) window.companies.push(normalized.ownerCompany);
      if (normalized.tax) window.taxes.push(normalized.tax);
      if (normalized.improvement) window.improvements.push(normalized.improvement);
      for (const sale of normalized.sales) window.sales.push(sale);
      pending += 1;

      if (pending >= PARCELS_PER_FLUSH) {
        await flushWindow(db, window, totals);
        window = emptyWindow();
        pending = 0;
        const sizeBytes = await databaseSizeBytes(db);
        console.log(
          `loaded ${totals.parcels} total, db ${megabytes(sizeBytes)} MB (read ${read}, skipped ${skipped})`,
        );
        if (!upgradeConfirmed && sizeBytes >= UPGRADE_CONFIRM_BYTES) {
          upgradeConfirmed = true;
          console.log("UPGRADE CONFIRMED: passed 512MB, no throttle");
        }
      }
    }

    reader.close();

    if (pending > 0) {
      await flushWindow(db, window, totals);
      const sizeBytes = await databaseSizeBytes(db);
      console.log(
        `loaded ${totals.parcels} total, db ${megabytes(sizeBytes)} MB (read ${read}, skipped ${skipped}, final flush)`,
      );
      if (!upgradeConfirmed && sizeBytes >= UPGRADE_CONFIRM_BYTES) {
        upgradeConfirmed = true;
        console.log("UPGRADE CONFIRMED: passed 512MB, no throttle");
      }
    }

    await rebuildMaterializations(db);
    await vacuumLoadedTables(db);
    await integrityCheck(db);

    const finalSizeBytes = await databaseSizeBytes(db);
    console.log(
      `[load] DONE; read ${read} staged lines; loaded ${totals.parcels} parcels; ` +
        `skipped ${skipped}; final db size ${megabytes(finalSizeBytes)} MB`,
    );
    console.log("[load] totals:", JSON.stringify(totals));
  } catch (error) {
    if (isThrottleError(error)) {
      console.error("throttle still active — upgrade not effective on this project/branch");
      process.exitCode = 2;
      return;
    }
    throw error;
  } finally {
    await pool.end();
  }
}

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error("[load] failed:", error);
    process.exit(1);
  });

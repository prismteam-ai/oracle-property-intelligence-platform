import { sql } from "drizzle-orm";

import { loadLocalEnv } from "../ingest/env";

loadLocalEnv();


import { db } from "@/server/pg";
import { entityDocuments } from "@/db/schema";
import type { NewEntityDocument } from "@/db/schema/types";
import { leepaParcelUrl, sunbizUrl, bbbProfileUrl } from "@/db/seed/url-builders";

const CORPUS_SOURCE = "oracle-corpus";
const INSERT_BATCH = 500;

type EntityType = "property" | "owner" | "project" | "tenant" | "contractor" | "business";

const ALL_TYPES: EntityType[] = [
  "property",
  "owner",
  "project",
  "tenant",
  "contractor",
  "business",
];

type BuildArgs = {
  countOnly: boolean;
  limit: number | null;
  types: EntityType[];
};

function parseArgs(argv: string[]): BuildArgs {
  let countOnly = false;
  let limit: number | null = null;
  let types = ALL_TYPES;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--count-only") countOnly = true;
    else if (a === "--limit") limit = Number(argv[++i] ?? "");
    else if (a === "--types") types = (argv[++i] ?? "").split(",") as EntityType[];
  }
  return { countOnly, limit, types };
}

function strapToDigits(parcelIdentifier: string): string {
  return parcelIdentifier.replace(/[^0-9A-Za-z]/g, "");
}

function doc(
  overrides: Pick<
    NewEntityDocument,
    "entityType" | "entityId" | "title" | "body" | "sourceRecordKey"
  > &
    Partial<NewEntityDocument>,
): NewEntityDocument {
  return {
    corpusType: overrides.entityType,
    sourceSystem: CORPUS_SOURCE,
    metadata: { entityType: overrides.entityType, jurisdiction: "fl-lee" },
    sourceSystems: overrides.sourceSystems ?? ["oracle"],
    citations: overrides.citations ?? { items: [] },
    subtitle: overrides.subtitle ?? null,
    ...overrides,
  };
}

type PerTypeLimit = Partial<Record<EntityType, number>>;

function representativeMix(limit: number, types: EntityType[]): PerTypeLimit {
  const weights: Record<EntityType, number> = {
    property: 5,
    owner: 5,
    project: 4,
    tenant: 2,
    contractor: 2,
    business: 2,
  };
  const active = types.filter((t) => weights[t] > 0);
  const totalWeight = active.reduce((s, t) => s + weights[t], 0);
  const out: PerTypeLimit = {};
  let assigned = 0;
  active.forEach((t, i) => {
    const share =
      i === active.length - 1
        ? limit - assigned
        : Math.max(1, Math.round((limit * weights[t]) / totalWeight));
    out[t] = share;
    assigned += share;
  });
  return out;
}

async function projectedCounts(types: EntityType[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const one = async (label: string, query: ReturnType<typeof sql>) => {
    const r = await db.execute<{ n: number }>(query);
    const rows = (r as { rows?: { n: number }[] }).rows ?? (r as unknown as { n: number }[]);
    out[label] = Number(rows[0]?.n ?? 0);
  };
  if (types.includes("property")) await one("property", sql`select count(*)::int n from properties`);
  if (types.includes("owner"))
    await one(
      "owner",
      sql`select (
        (select count(distinct owner_person_id) from ownerships where owner_person_id is not null)
        + (select count(distinct owner_company_id) from ownerships where owner_company_id is not null)
      )::int n`,
    );
  if (types.includes("project")) await one("project", sql`select count(*)::int n from projects`);
  if (types.includes("tenant")) await one("tenant", sql`select count(*)::int n from tenants`);
  if (types.includes("contractor"))
    await one("contractor", sql`select count(*)::int n from business_reputation_profiles`);
  if (types.includes("business"))
    await one("business", sql`select count(*)::int n from business_registrations`);
  out.total = Object.values(out).reduce((s, v) => s + v, 0);
  return out;
}

function lim(n: number | undefined): ReturnType<typeof sql> {
  return n != null ? sql` limit ${n}` : sql``;
}

async function buildProperties(limit?: number): Promise<NewEntityDocument[]> {
  const r = await db.execute<Record<string, unknown>>(sql`
    select p.property_id, p.parcel_identifier, p.subdivision, p.property_usage_type,
           p.property_type, p.property_structure_built_year, p.source_record_key,
           p.source_artifact_uri,
           coalesce(rl.municipality_name, '') as municipality_name,
           coalesce(rl.open_permit_count, 0) as open_permit_count,
           coalesce(rl.permit_count_5y, 0) as permit_count_5y,
           coalesce(rl.major_renovation_count, 0) as major_renovation_count,
           coalesce(rl.renovation_trades, '{}') as renovation_trades
    from properties p
    left join property_signal_rollups rl on rl.property_id = p.property_id
    order by p.property_id${lim(limit)}
  `);
  const rows = (r as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  return rows.map((p) => {
    const parcel = String(p.parcel_identifier);
    const url = p.source_artifact_uri
      ? String(p.source_artifact_uri)
      : leepaParcelUrl(strapToDigits(parcel));
    const trades = (p.renovation_trades as string[]) ?? [];
    const place = String(p.municipality_name) || String(p.subdivision ?? "Lee County");
    const signals = ` ${p.open_permit_count} open permit(s); ${p.permit_count_5y} permit(s) in 5y; ${p.major_renovation_count} major renovation(s); trades: ${trades.join(", ") || "none"}.`;
    return doc({
      entityType: "property",
      entityId: String(p.property_id),
      title: `Property ${parcel}`,
      subtitle: (p.subdivision as string) ?? null,
      body: `Property ${parcel} in ${place}, ${p.property_usage_type ?? "residential"}. Type ${p.property_type ?? "unknown"}, built ${p.property_structure_built_year ?? "unknown"}.${signals}`,
      sourceSystems: ["leepa", "lee_accela"],
      sourceUri: url,
      citations: {
        items: [{ label: "Lee County Property Appraiser", url, recordKey: String(p.source_record_key) }],
      },
      sourceRecordKey: `doc:property:${p.property_id}`,
    });
  });
}

async function buildOwners(limit?: number): Promise<NewEntityDocument[]> {
  const r = await db.execute<Record<string, unknown>>(sql`
    with owner_props as (
      select
        coalesce(o.owner_person_id::text, o.owner_company_id::text) as owner_key,
        case when o.owner_person_id is not null then 'person' else 'company' end as owner_kind,
        o.owner_person_id, o.owner_company_id,
        count(*) as parcel_count,
        min(pr.source_artifact_uri) as sample_uri,
        min(pr.parcel_identifier) as sample_parcel,
        bool_or(o.owner_occupied_indicator) as owner_occupied
      from ownerships o
      join properties pr on pr.property_id = o.property_id
      where o.owner_person_id is not null or o.owner_company_id is not null
      group by 1, 2, o.owner_person_id, o.owner_company_id
    )
    select op.*,
           coalesce(pe.full_name, co.name) as owner_name,
           coalesce(pe.source_record_key, co.source_record_key) as src_key
    from owner_props op
    left join people pe on pe.person_id = op.owner_person_id
    left join companies co on co.company_id = op.owner_company_id
    order by op.owner_key${lim(limit)}
  `);
  const rows = (r as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  return rows.map((o) => {
    const name = String(o.owner_name ?? "Owner");
    const kind = String(o.owner_kind);
    const count = Number(o.parcel_count);
    const url = o.sample_uri ? String(o.sample_uri) : null;
    const occ = o.owner_occupied ? "owner-occupied" : "non-owner-occupied";
    return doc({
      entityType: "owner",
      entityId: kind === "person" ? String(o.owner_person_id) : String(o.owner_company_id),
      title: name,
      subtitle: `${kind} owner`,
      body: `${name} is a Lee County property ${kind === "person" ? "owner" : "owning entity"} holding ${count} parcel(s) (${occ}). Sample parcel ${o.sample_parcel}.`,
      sourceSystems: ["leepa"],
      sourceUri: url,
      citations: url
        ? { items: [{ label: "Lee County Property Appraiser", url, recordKey: String(o.src_key ?? "") }] }
        : { items: [] },
      sourceRecordKey: `doc:owner:${o.owner_key}`,
    });
  });
}

async function buildProjects(limit?: number): Promise<NewEntityDocument[]> {
  const r = await db.execute<Record<string, unknown>>(sql`
    select project_id, project_name, project_status, is_major_renovation,
           renovation_trades, permit_count, parcel_id
    from projects order by project_id${lim(limit)}
  `);
  const rows = (r as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  return rows.map((pr) => {
    const trades = (pr.renovation_trades as string[]) ?? [];
    return doc({
      entityType: "project",
      entityId: String(pr.project_id),
      title: String(pr.project_name ?? "Project"),
      subtitle: (pr.project_status as string) ?? null,
      body: `${pr.project_name}: ${pr.permit_count ?? 0} permit(s), ${pr.is_major_renovation ? "major renovation" : "maintenance"}, trades: ${trades.join(", ") || "none"}.`,
      sourceSystems: ["oracle", "lee_accela"],
      citations: { items: [] },
      sourceRecordKey: `doc:project:${pr.project_id}`,
    });
  });
}

async function buildTenants(limit?: number): Promise<NewEntityDocument[]> {
  const r = await db.execute<Record<string, unknown>>(sql`
    select tenant_id, tenant_name, tenant_type from tenants order by tenant_id${lim(limit)}
  `);
  const rows = (r as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  return rows.map((t) =>
    doc({
      entityType: "tenant",
      entityId: String(t.tenant_id),
      title: String(t.tenant_name ?? "Tenant"),
      subtitle: (t.tenant_type as string) ?? null,
      body: `${t.tenant_name} is a ${t.tenant_type ?? "residential"} tenant in Lee County.`,
      sourceSystems: ["oracle"],
      citations: { items: [] },
      sourceRecordKey: `doc:tenant:${t.tenant_id}`,
    }),
  );
}

async function buildContractors(limit?: number): Promise<NewEntityDocument[]> {
  const r = await db.execute<Record<string, unknown>>(sql`
    select business_reputation_profile_id, company_id, name, bbb_rating,
           review_count, review_average_rating, complaint_count, profile_url,
           profile_slug, source_record_key
    from business_reputation_profiles order by business_reputation_profile_id${lim(limit)}
  `);
  const rows = (r as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  return rows.map((b) => {
    const url = b.profile_url ? String(b.profile_url) : bbbProfileUrl(String(b.profile_slug ?? "contractor"));
    return doc({
      entityType: "contractor",
      entityId: (b.company_id as string) ?? null,
      title: String(b.name ?? "Contractor"),
      subtitle: `BBB rating ${b.bbb_rating ?? "NR"}`,
      body: `${b.name} is a Lee County contractor. BBB rating ${b.bbb_rating ?? "NR"}, ${b.review_count ?? 0} reviews (avg ${b.review_average_rating ?? "n/a"}), ${b.complaint_count ?? 0} complaints.`,
      sourceSystems: ["bbb"],
      sourceUri: url,
      citations: { items: [{ label: "BBB Profile", url, recordKey: String(b.source_record_key) }] },
      sourceRecordKey: `doc:contractor:${b.business_reputation_profile_id}`,
    });
  });
}

async function buildBusinesses(limit?: number): Promise<NewEntityDocument[]> {
  const r = await db.execute<Record<string, unknown>>(sql`
    select business_registration_id, entity_name, document_number, filing_type,
           status, filed_date, source_record_key, source_artifact_uri
    from business_registrations order by business_registration_id${lim(limit)}
  `);
  const rows = (r as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  return rows.map((reg) => {
    const url = reg.source_artifact_uri ? String(reg.source_artifact_uri) : sunbizUrl(String(reg.document_number));
    const filed = reg.filed_date ? new Date(String(reg.filed_date)).toISOString().slice(0, 10) : "unknown";
    return doc({
      entityType: "business",
      entityId: String(reg.business_registration_id),
      title: String(reg.entity_name ?? "Business"),
      subtitle: (reg.filing_type as string) ?? null,
      body: `${reg.entity_name} (doc ${reg.document_number}) is a ${reg.filing_type ?? "Florida entity"}, status ${reg.status ?? "unknown"}, filed ${filed}.`,
      sourceSystems: ["sunbiz"],
      sourceUri: url,
      citations: { items: [{ label: "Florida Sunbiz", url, recordKey: String(reg.source_record_key) }] },
      sourceRecordKey: `doc:business:${reg.business_registration_id}`,
    });
  });
}

const BUILDERS: Record<EntityType, (limit?: number) => Promise<NewEntityDocument[]>> = {
  property: buildProperties,
  owner: buildOwners,
  project: buildProjects,
  tenant: buildTenants,
  contractor: buildContractors,
  business: buildBusinesses,
};

async function insertDocs(docs: NewEntityDocument[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < docs.length; i += INSERT_BATCH) {
    const batch = docs.slice(i, i + INSERT_BATCH);
    if (batch.length === 0) continue;
    const r = await db
      .insert(entityDocuments)
      .values(batch)
      .onConflictDoNothing({
        target: [entityDocuments.sourceSystem, entityDocuments.sourceRecordKey],
      })
      .returning({ id: entityDocuments.documentId });
    inserted += (r as { length: number }).length;
  }
  return inserted;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.countOnly) {
    const counts = await projectedCounts(args.types);
    process.stdout.write(`corpus projection: ${JSON.stringify(counts)}\n`);
    process.exit(0);
  }

  const perType: PerTypeLimit =
    args.limit != null ? representativeMix(args.limit, args.types) : {};

  let total = 0;
  const byType: Record<string, number> = {};
  for (const t of args.types) {
    const docs = await BUILDERS[t](perType[t]);
    const n = await insertDocs(docs);
    byType[t] = n;
    total += n;
    process.stdout.write(`built ${t}: generated ${docs.length}, inserted ${n}\n`);
  }
  process.stdout.write(`corpus build done: ${total} new documents ${JSON.stringify(byType)}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("corpus build failed:", err);
  process.exit(1);
});

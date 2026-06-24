import { neon } from "@neondatabase/serverless";
import type {
  BusinessRecord,
  ContractorRecord,
  OracleData,
  OwnerRecord,
  Permit,
  PropertyRecord,
  SourceProvenance
} from "@oracle-command-center/domain";
import { fixtureData } from "../../fixtures/src/index.js";

export type OracleDataSourceMode = "fixture" | "elephant-query-db";

export interface OracleDataSourceEnv {
  DATABASE_URL?: string;
  ORACLE_DATA_SOURCE?: string;
}

export interface QueryDbCoverage {
  properties: number;
  permits: number;
  companies: number;
  bbbProfiles: number;
  complaints: number;
  contractorQualityScores: number;
  addresses: number;
  businessRegistrations: number;
  ownerships: number;
  sourcePayloadTables: number;
}

export interface QueryDbSurfaceCheck {
  name: string;
  kind: "view" | "table" | "column" | "source_payload";
  ok: boolean;
  count?: number;
  message?: string;
}

export interface QueryDbColumnContract {
  name: string;
  types: readonly string[];
  nullable?: boolean;
}

export interface QueryDbReadinessReport {
  resource: typeof ELEPHANT_QUERY_DB_CONTRACT.resource;
  envVar: "DATABASE_URL";
  ready: boolean;
  coverage: QueryDbCoverage;
  checks: QueryDbSurfaceCheck[];
  missing: string[];
}

export interface OracleDataSourceHealth {
  mode: OracleDataSourceMode;
  ready: boolean;
  resource: string;
  envVar: "DATABASE_URL";
  serverOnly: true;
  contract: typeof ELEPHANT_QUERY_DB_CONTRACT;
  coverage?: QueryDbCoverage;
  checks?: QueryDbSurfaceCheck[];
  missing?: string[];
  message?: string;
}

export interface OracleDataSource {
  readonly mode: OracleDataSourceMode;
  getOracleData(): Promise<OracleData>;
  health(): Promise<OracleDataSourceHealth>;
}

type SqlClient = ReturnType<typeof neon>;
type SqlRow = Record<string, unknown>;

export const ELEPHANT_QUERY_DB_CONTRACT = {
  source: "soofi-xyz/soofi-xyz-team-kit#54",
  skill: "use-elephant-query-db",
  resource: "elephant-query-db",
  vercelTeam: "elephant-xyz",
  vercelProject: "website",
  region: "iad1",
  envVar: "DATABASE_URL",
  schemaPackage: "@elephant-xyz/query-db",
  primaryViews: ["property_profile_view", "permit_search_view", "company_profile_view", "address_profile_view"],
  primaryTables: [
    "properties",
    "parcels",
    "ownerships",
    "property_improvements",
    "business_registrations",
    "business_reputation_profiles",
    "business_reputation_complaints",
    "business_reputation_reviews",
    "contractor_quality_scores",
    "addresses"
  ],
  sourcePayloadTables: [
    "properties",
    "property_improvements",
    "business_registrations",
    "business_reputation_profiles",
    "business_reputation_complaints",
    "contractor_quality_scores"
  ],
  columns: {
    property_profile_view: [
      { name: "property_id", types: ["text", "character varying"] },
      { name: "parcel_identifier", types: ["text", "character varying"] },
      { name: "property_type", types: ["text", "character varying"] },
      { name: "property_usage_type", types: ["text", "character varying"] },
      { name: "property_structure_built_year", types: ["integer", "bigint", "numeric"] },
      { name: "subdivision", types: ["text", "character varying"] },
      { name: "zoning", types: ["text", "character varying"] }
    ],
    permit_search_view: [
      { name: "permit_number", types: ["text", "character varying"] },
      { name: "improvement_type", types: ["text", "character varying"] },
      { name: "improvement_status", types: ["text", "character varying"] },
      { name: "source_status", types: ["text", "character varying"] },
      { name: "record_status", types: ["text", "character varying"] },
      { name: "application_received_date", types: ["text", "character varying", "date", "timestamp without time zone", "timestamp with time zone"] },
      { name: "permit_issue_date", types: ["text", "character varying", "date", "timestamp without time zone", "timestamp with time zone"] },
      { name: "permit_close_date", types: ["text", "character varying", "date", "timestamp without time zone", "timestamp with time zone"] },
      { name: "parcel_identifier", types: ["text", "character varying"] },
      { name: "unnormalized_address", types: ["text", "character varying"] },
      { name: "city_name", types: ["text", "character varying"] },
      { name: "contractor_company_id", types: ["text", "character varying"] },
      { name: "contractor_name", types: ["text", "character varying"] }
    ],
    company_profile_view: [
      { name: "company_id", types: ["text", "character varying"] },
      { name: "name", types: ["text", "character varying"] },
      { name: "document_number", types: ["text", "character varying"] },
      { name: "status", types: ["text", "character varying"] },
      { name: "filing_type", types: ["text", "character varying"] },
      { name: "filed_date", types: ["text", "character varying", "date", "timestamp without time zone", "timestamp with time zone"] }
    ],
    address_profile_view: [
      { name: "address_id", types: ["text", "character varying"] },
      { name: "property_id", types: ["text", "character varying"] },
      { name: "unnormalized_address", types: ["text", "character varying"] },
      { name: "city_name", types: ["text", "character varying"] }
    ],
    properties: [
      { name: "property_id", types: ["text", "character varying"] },
      { name: "parcel_identifier", types: ["text", "character varying"] },
      { name: "source_payload", types: ["jsonb"] }
    ],
    property_improvements: [
      { name: "property_improvement_id", types: ["text", "character varying"] },
      { name: "property_id", types: ["text", "character varying"] },
      { name: "permit_number", types: ["text", "character varying"] },
      { name: "contractor_company_id", types: ["text", "character varying"] },
      { name: "source_payload", types: ["jsonb"] }
    ],
    business_registrations: [
      { name: "business_registration_id", types: ["text", "character varying"] },
      { name: "company_id", types: ["text", "character varying"] },
      { name: "document_number", types: ["text", "character varying"] },
      { name: "source_payload", types: ["jsonb"] }
    ],
    business_reputation_profiles: [
      { name: "business_reputation_profile_id", types: ["text", "character varying"] },
      { name: "company_id", types: ["text", "character varying"] },
      { name: "bbb_rating", types: ["text", "character varying"] },
      { name: "review_average_rating", types: ["numeric", "integer", "double precision", "real"] },
      { name: "complaint_count", types: ["integer", "bigint", "numeric"] },
      { name: "source_payload", types: ["jsonb"] }
    ],
    business_reputation_complaints: [
      { name: "complaint_id", types: ["text", "character varying"] },
      { name: "business_reputation_profile_id", types: ["text", "character varying"] },
      { name: "company_id", types: ["text", "character varying"] },
      { name: "summary", types: ["text", "character varying"] },
      { name: "status", types: ["text", "character varying"] },
      { name: "source_payload", types: ["jsonb"] }
    ],
    business_reputation_reviews: [
      { name: "review_id", types: ["text", "character varying"] },
      { name: "business_reputation_profile_id", types: ["text", "character varying"] },
      { name: "company_id", types: ["text", "character varying"] },
      { name: "review_average_rating", types: ["numeric", "integer", "double precision", "real"] },
      { name: "source_payload", types: ["jsonb"] }
    ],
    contractor_quality_scores: [
      { name: "contractor_quality_score_id", types: ["text", "character varying"] },
      { name: "business_reputation_profile_id", types: ["text", "character varying"] },
      { name: "company_id", types: ["text", "character varying"] },
      { name: "score", types: ["numeric", "integer", "double precision", "real"] },
      { name: "source_payload", types: ["jsonb"] }
    ],
    ownerships: [
      { name: "ownership_id", types: ["text", "character varying"] },
      { name: "property_id", types: ["text", "character varying"] },
      { name: "owned_by", types: ["text", "character varying"] },
      { name: "property_ownership_structure", types: ["text", "character varying"] },
      { name: "source_payload", types: ["jsonb"] }
    ],
    parcels: [
      { name: "parcel_id", types: ["text", "character varying"] },
      { name: "property_id", types: ["text", "character varying"] },
      { name: "parcel_identifier", types: ["text", "character varying"] },
      { name: "source_payload", types: ["jsonb"] }
    ],
    addresses: [
      { name: "address_id", types: ["text", "character varying"] },
      { name: "property_id", types: ["text", "character varying"] },
      { name: "unnormalized_address", types: ["text", "character varying"] },
      { name: "city_name", types: ["text", "character varying"] },
      { name: "source_payload", types: ["jsonb"] }
    ]
  } satisfies Record<string, readonly QueryDbColumnContract[]>,
  queryPaths: [
    "parcel -> property -> permits",
    "permit -> inspections/contacts/links/custom_fields",
    "company -> Sunbiz registration",
    "company -> BBB reputation/quality score",
    "address -> property/business profile"
  ]
} as const;

const TODAY = "2026-06-18";

export class FixtureOracleDataSource implements OracleDataSource {
  readonly mode = "fixture" as const;

  async getOracleData(): Promise<OracleData> {
    return fixtureData;
  }

  async health(): Promise<OracleDataSourceHealth> {
    return {
      mode: this.mode,
      ready: true,
      resource: "deterministic-fixture-corpus",
      envVar: "DATABASE_URL",
      serverOnly: true,
      contract: ELEPHANT_QUERY_DB_CONTRACT,
      coverage: {
        properties: fixtureData.properties.length,
        permits: fixtureData.properties.reduce((sum, property) => sum + property.permits.length, 0),
        companies: fixtureData.businesses.length,
        bbbProfiles: fixtureData.contractors.length,
        complaints: fixtureData.contractors.reduce((sum, contractor) => sum + contractor.complaints.length, 0),
        contractorQualityScores: fixtureData.contractors.length,
        addresses: fixtureData.properties.length,
        businessRegistrations: fixtureData.businesses.length,
        ownerships: fixtureData.owners.length,
        sourcePayloadTables: 0
      },
      message: "Fixture mode is active. Set ORACLE_DATA_SOURCE=elephant-query-db and DATABASE_URL to query a contract-compatible Vercel Postgres/Neon database."
    };
  }
}

export class ElephantQueryDbDataSource implements OracleDataSource {
  readonly mode = "elephant-query-db" as const;
  private readonly databaseUrl: string | undefined;
  private readonly limit: number;
  private sqlClient: SqlClient | null = null;

  constructor(options: { databaseUrl?: string; limit?: number } = {}) {
    this.databaseUrl = options.databaseUrl;
    this.limit = options.limit ?? 250;
  }

  async getOracleData(): Promise<OracleData> {
    const sql = this.sql();
    const [propertyRows, permitRows, companyRows, contractorRows, complaintRows, ownerRows] = await Promise.all([
      sql`
        select property_id, parcel_identifier, property_type, property_usage_type,
               property_structure_built_year, subdivision, zoning
        from property_profile_view
        order by parcel_identifier nulls last
        limit ${this.limit}
      `,
      sql`
        select permit_number, improvement_type, improvement_status, source_status,
               record_status, application_received_date, permit_issue_date, permit_close_date,
               parcel_identifier, unnormalized_address, city_name, contractor_company_id,
               contractor_name
        from permit_search_view
        order by permit_issue_date desc nulls last
        limit ${this.limit * 3}
      `,
      sql`
        select company_id, name, document_number, status, filing_type, filed_date
        from company_profile_view
        order by filed_date desc nulls last
        limit ${this.limit}
      `,
      sql`
        select business_reputation_profile_id, company_id, name, legal_name, profile_url,
               bbb_rating, review_average_rating, complaint_count, closed_complaints_past_three_years
        from business_reputation_profiles
        order by rating_score desc nulls last
        limit ${this.limit}
      `,
      sql`
        select business_reputation_profile_id, company_id, summary, complaint_date, status
        from business_reputation_complaints
        order by complaint_date desc nulls last
        limit ${this.limit * 3}
      `,
      sql`
        select property_id, owned_by, property_ownership_structure, date_acquired, date_sold
        from ownerships
        order by date_acquired desc nulls last
        limit ${this.limit * 2}
      `
    ]);

    const properties = mapProperties(propertyRows as SqlRow[], permitRows as SqlRow[], ownerRows as SqlRow[]);
    const businesses = mapBusinesses(companyRows as SqlRow[]);
    const contractors = mapContractors(contractorRows as SqlRow[], complaintRows as SqlRow[], permitRows as SqlRow[]);
    const owners = mapOwners(ownerRows as SqlRow[], properties);
    const permits = properties.reduce((sum, property) => sum + property.permits.length, 0);

    return {
      ...fixtureData,
      properties,
      businesses,
      contractors,
      owners,
      tenants: fixtureData.tenants,
      turnover: fixtureData.turnover,
      corpus: {
        ...fixtureData.corpus,
        properties: properties.length,
        permits,
        contractors: contractors.length,
        businesses: businesses.length,
        owners: owners.length,
        tenants: fixtureData.tenants.length,
        sources: fixtureData.corpus.sources + 1,
        lastRefresh: new Date().toISOString(),
        county: "Lee County, FL"
      }
    };
  }

  async health(): Promise<OracleDataSourceHealth> {
    if (!this.databaseUrl || this.databaseUrl.trim().length === 0) {
      return {
        mode: this.mode,
        ready: false,
        resource: ELEPHANT_QUERY_DB_CONTRACT.resource,
        envVar: "DATABASE_URL",
        serverOnly: true,
        contract: ELEPHANT_QUERY_DB_CONTRACT,
        message: "DATABASE_URL is required for live Elephant Query DB mode. Use your Vercel Postgres/Neon database after seeding the PR #54 contract."
      };
    }

    const report = await this.validateReadiness();
    return {
      mode: this.mode,
      ready: report.ready,
      resource: ELEPHANT_QUERY_DB_CONTRACT.resource,
      envVar: "DATABASE_URL",
      serverOnly: true,
      contract: ELEPHANT_QUERY_DB_CONTRACT,
      coverage: report.coverage,
      checks: report.checks,
      missing: report.missing,
      message: report.ready ? "Live Elephant Query DB surface is ready." : `Live Elephant Query DB is missing: ${report.missing.join(", ")}`
    };
  }

  async coverage(): Promise<QueryDbCoverage> {
    return (await this.validateReadiness()).coverage;
  }

  async validateReadiness(): Promise<QueryDbReadinessReport> {
    const sql = this.sql();
    const checks = await Promise.all([
      countSurface(sql, "property_profile_view", "view"),
      countSurface(sql, "permit_search_view", "view"),
      countSurface(sql, "company_profile_view", "view"),
      countSurface(sql, "address_profile_view", "view"),
      countSurface(sql, "properties", "table"),
      countSurface(sql, "parcels", "table"),
      countSurface(sql, "ownerships", "table"),
      countSurface(sql, "property_improvements", "table"),
      countSurface(sql, "business_registrations", "table"),
      countSurface(sql, "business_reputation_profiles", "table"),
      countSurface(sql, "business_reputation_complaints", "table"),
      countSurface(sql, "business_reputation_reviews", "table"),
      countSurface(sql, "contractor_quality_scores", "table"),
      countSurface(sql, "addresses", "table"),
      ...Object.entries(ELEPHANT_QUERY_DB_CONTRACT.columns).flatMap(([surfaceName, columns]) =>
        columns.map((column) => columnContractCheck(sql, surfaceName, column))
      ),
      sourcePayloadCheck(sql, "properties"),
      sourcePayloadCheck(sql, "property_improvements"),
      sourcePayloadCheck(sql, "business_registrations"),
      sourcePayloadCheck(sql, "business_reputation_profiles"),
      sourcePayloadCheck(sql, "business_reputation_complaints"),
      sourcePayloadCheck(sql, "contractor_quality_scores")
    ]);
    const byName = new Map(checks.map((check) => [check.name, check]));
    const sourcePayloadTables = checks.filter((check) => check.kind === "source_payload" && check.ok).length;
    const coverage = {
      properties: byName.get("property_profile_view")?.count ?? 0,
      permits: byName.get("permit_search_view")?.count ?? 0,
      companies: byName.get("company_profile_view")?.count ?? 0,
      bbbProfiles: byName.get("business_reputation_profiles")?.count ?? 0,
      complaints: byName.get("business_reputation_complaints")?.count ?? 0,
      contractorQualityScores: byName.get("contractor_quality_scores")?.count ?? 0,
      addresses: byName.get("address_profile_view")?.count ?? 0,
      businessRegistrations: byName.get("business_registrations")?.count ?? 0,
      ownerships: byName.get("ownerships")?.count ?? 0,
      sourcePayloadTables
    };
    const missing = checks.filter((check) => !check.ok).map((check) => check.name);
    return {
      resource: ELEPHANT_QUERY_DB_CONTRACT.resource,
      envVar: "DATABASE_URL",
      ready: missing.length === 0 && coverage.properties > 0 && coverage.permits > 0,
      coverage,
      checks,
      missing
    };
  }

  private sql(): SqlClient {
    if (!this.databaseUrl || this.databaseUrl.trim().length === 0) {
      throw new Error("DATABASE_URL is required to query the elephant-query-db contract surface");
    }
    this.sqlClient ??= neon(this.databaseUrl);
    return this.sqlClient;
  }
}

export function createOracleDataSource(env: OracleDataSourceEnv = {}): OracleDataSource {
  const requestedMode = env.ORACLE_DATA_SOURCE === "elephant-query-db" ? "elephant-query-db" : "fixture";
  if (requestedMode === "elephant-query-db") {
    return new ElephantQueryDbDataSource({ databaseUrl: env.DATABASE_URL });
  }
  return new FixtureOracleDataSource();
}

export function getDataSourceReadiness(env: OracleDataSourceEnv = {}): OracleDataSourceHealth {
  const mode = env.ORACLE_DATA_SOURCE === "elephant-query-db" ? "elephant-query-db" : "fixture";
  const hasDatabaseUrl = typeof env.DATABASE_URL === "string" && env.DATABASE_URL.trim().length > 0;
  return {
    mode,
    ready: mode === "fixture" || hasDatabaseUrl,
    resource: mode === "fixture" ? "deterministic-fixture-corpus" : ELEPHANT_QUERY_DB_CONTRACT.resource,
    envVar: "DATABASE_URL",
    serverOnly: true,
    contract: ELEPHANT_QUERY_DB_CONTRACT,
    message:
      mode === "elephant-query-db" && !hasDatabaseUrl
        ? "DATABASE_URL is required for live Elephant Query DB mode."
        : "Data source is configured."
  };
}

function mapProperties(propertyRows: SqlRow[], permitRows: SqlRow[], ownerRows: SqlRow[]): PropertyRecord[] {
  return propertyRows.map((row, index) => {
    const id = textValue(row.property_id) || `live-property-${index + 1}`;
    const parcel = textValue(row.parcel_identifier) || `live-parcel-${index + 1}`;
    const fixtureMatch = fixtureData.properties.find((property) => property.id === id || property.parcel === parcel);
    const relatedPermits = permitRows.filter((permit) => textValue(permit.parcel_identifier) === parcel);
    const relatedOwners = ownerRows.filter((owner) => textValue(owner.property_id) === textValue(row.property_id));
    return {
      id,
      address: textValue(relatedPermits[0]?.unnormalized_address) || fixtureMatch?.address || parcel,
      city: textValue(relatedPermits[0]?.city_name) || fixtureMatch?.city || "Lee County",
      neighborhood: textValue(row.subdivision) || textValue(row.zoning) || "Unclassified",
      parcel,
      class: textValue(row.property_usage_type) || textValue(row.property_type) || "Property",
      year: numberValue(row.property_structure_built_year) || fixtureMatch?.year || 0,
      owner: ownerId(relatedOwners[0], index),
      ownerHistory: relatedOwners.length
        ? relatedOwners.map((owner, ownerIndex) => ({
            owner: textValue(owner.owned_by) || `Owner ${ownerIndex + 1}`,
            date: textValue(owner.date_acquired) || TODAY,
            type: textValue(owner.property_ownership_structure) || "Ownership"
        }))
        : [{ owner: "Unknown owner", date: TODAY, type: "Query DB record" }],
      tenants: fixtureMatch?.tenants ?? [],
      businesses: fixtureMatch?.businesses ?? [],
      permits: relatedPermits.map(mapPermit),
      src: [queryDbSource(`property_profile_view/${parcel}`)]
    };
  });
}

function mapPermit(row: SqlRow): Permit {
  const type = textValue(row.improvement_type) || "Permit";
  return {
    id: textValue(row.permit_number) || "unknown-permit",
    type,
    status: textValue(row.improvement_status) || textValue(row.source_status) || textValue(row.record_status) || "Unknown",
    contractor: contractorId(row),
    value: 0,
    filed: textValue(row.application_received_date) || textValue(row.permit_issue_date) || TODAY,
    scope: type,
    major: /roof|electrical|concrete|structural|plumb|hvac/i.test(type)
  };
}

function mapBusinesses(rows: SqlRow[]): BusinessRecord[] {
  return rows.map((row, index) => {
    const id = textValue(row.company_id) || `live-business-${index + 1}`;
    const fixtureMatch = fixtureData.businesses.find((business) => business.id === id || business.sunbiz === textValue(row.document_number));
    return {
    id,
    name: textValue(row.name) || textValue(row.document_number) || `Business ${index + 1}`,
    btype: textValue(row.filing_type) || "Business",
    sunbiz: textValue(row.document_number) || `live-doc-${index + 1}`,
    status: textValue(row.status) || "Unknown",
    owner: fixtureMatch?.owner ?? "Query DB company profile",
    locations: fixtureMatch?.locations ?? [],
    registered: textValue(row.filed_date) || TODAY,
    src: [queryDbSource(`company_profile_view/${textValue(row.company_id) || index + 1}`)]
    };
  });
}

function mapContractors(rows: SqlRow[], complaintRows: SqlRow[], permitRows: SqlRow[]): ContractorRecord[] {
  return rows.map((row, index) => {
    const id = contractorId(row) || `live-contractor-${index + 1}`;
    const fixtureMatch = fixtureData.contractors.find((contractor) => contractor.id === id || contractor.name === textValue(row.name));
    const relatedPermits = permitRows.filter((permit) => contractorId(permit) === id);
    const relatedComplaints = complaintRows.filter((complaint) => contractorId(complaint) === id || textValue(complaint.company_id) === id);
    const derivedTrades = uniqueText(relatedPermits.map((permit) => textValue(permit.improvement_type))).slice(0, 4);
    return {
    id,
    name: textValue(row.name) || textValue(row.legal_name) || `Contractor ${index + 1}`,
    license: "Query DB BBB profile",
    trades: fixtureMatch?.trades ?? (derivedTrades.length ? derivedTrades : ["Contractor"]),
    county: "Lee",
    projects: relatedPermits.length || fixtureMatch?.projects || 0,
    bbb: textValue(row.bbb_rating) || "Not Rated",
    complaints: relatedComplaints.length
      ? relatedComplaints.map((complaint) => ({
          date: textValue(complaint.complaint_date) || TODAY,
          summary: textValue(complaint.summary) || "Complaint record",
          status: textValue(complaint.status) || "Unknown"
        }))
      : fixtureMatch?.complaints ?? [],
    review: numberValue(row.review_average_rating),
    src: [queryDbSource(textValue(row.profile_url) || `business_reputation_profiles/${index + 1}`)]
    };
  });
}

function mapOwners(rows: SqlRow[], properties: PropertyRecord[]): OwnerRecord[] {
  const owners = new Map<string, OwnerRecord>();
  rows.forEach((row, index) => {
    const id = ownerId(row, index);
    const propertyIds = properties
      .filter((property) => property.owner === id)
      .map((property) => property.id);
    owners.set(id, {
      id,
      name: textValue(row.owned_by) || `Owner ${index + 1}`,
      type: textValue(row.property_ownership_structure) || "Owner",
      since: textValue(row.date_acquired) || TODAY,
      props: propertyIds,
      src: [queryDbSource(`ownerships/${textValue(row.property_id) || index + 1}`)]
    });
  });
  return [...owners.values()];
}

function queryDbSource(ref: string): SourceProvenance {
  const safeRef = ref.startsWith("http") ? ref : `elephant-query-db/${ref}`;
  return {
    system: "Elephant Query DB",
    url: safeRef.startsWith("http") ? safeRef : "https://github.com/soofi-xyz/soofi-xyz-team-kit/pull/54",
    collected: TODAY,
    refreshed: TODAY,
    entity: safeRef
  };
}

async function countSurface(sql: SqlClient, name: string, kind: "view" | "table"): Promise<QueryDbSurfaceCheck> {
  try {
    const rows = await sql(`select count(*)::int as count from ${name}`);
    const row = (rows as SqlRow[])[0] ?? {};
    return { name, kind, ok: true, count: numberValue(row.count) };
  } catch (error) {
    return { name, kind, ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function columnContractCheck(sql: SqlClient, surfaceName: string, column: QueryDbColumnContract): Promise<QueryDbSurfaceCheck> {
  const name = `${surfaceName}.${column.name}`;
  try {
    const rows = await sql`
      select data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${surfaceName}
        and column_name = ${column.name}
      limit 1
    `;
    const row = (rows as SqlRow[])[0];
    if (!row) {
      return { name, kind: "column", ok: false, message: `Missing column ${name}` };
    }
    const dataType = textValue(row.data_type).toLowerCase();
    const typeOk = column.types.map((type) => type.toLowerCase()).includes(dataType);
    const nullableOk = column.nullable === undefined || (column.nullable ? textValue(row.is_nullable) === "YES" : textValue(row.is_nullable) === "NO");
    return {
      name,
      kind: "column",
      ok: typeOk && nullableOk,
      message:
        typeOk && nullableOk
          ? undefined
          : `Column ${name} expected ${column.types.join(" | ")}${column.nullable === undefined ? "" : column.nullable ? " nullable" : " not null"} but found ${dataType} ${textValue(row.is_nullable)}`
    };
  } catch (error) {
    return { name, kind: "column", ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function sourcePayloadCheck(sql: SqlClient, tableName: string): Promise<QueryDbSurfaceCheck> {
  const name = `${tableName}.source_payload`;
  try {
    const rows = await sql`
      select count(*)::int as count
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = 'source_payload'
    `;
    const count = numberValue(((rows as SqlRow[])[0] ?? {}).count);
    return {
      name,
      kind: "source_payload",
      ok: count > 0,
      count,
      message: count > 0 ? undefined : `Missing source_payload column on ${tableName}`
    };
  } catch (error) {
    return { name, kind: "source_payload", ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function contractorId(row: SqlRow | undefined): string {
  return textValue(row?.contractor_company_id) || textValue(row?.company_id) || textValue(row?.business_reputation_profile_id) || "live-contractor";
}

function ownerId(row: SqlRow | undefined, index: number): string {
  return `live-owner-${textValue(row?.owned_by).toLowerCase().replace(/[^a-z0-9]+/g, "-") || index + 1}`;
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function uniqueText(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

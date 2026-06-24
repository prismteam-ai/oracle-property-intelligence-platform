#!/usr/bin/env node
"use strict";

const path = require("path");
const { createRequire } = require("module");

const root = path.join(__dirname, "..");
const requireFromDataSource = createRequire(path.join(root, "packages/oracle-data-source/package.json"));

const CONTRACT = {
  resource: "elephant-query-db",
  envVar: "DATABASE_URL",
  views: ["property_profile_view", "permit_search_view", "company_profile_view", "address_profile_view"],
  tables: [
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
    property_profile_view: {
      property_id: ["text", "character varying"],
      parcel_identifier: ["text", "character varying"],
      property_type: ["text", "character varying"],
      property_usage_type: ["text", "character varying"],
      property_structure_built_year: ["integer", "bigint", "numeric"],
      subdivision: ["text", "character varying"],
      zoning: ["text", "character varying"]
    },
    permit_search_view: {
      permit_number: ["text", "character varying"],
      improvement_type: ["text", "character varying"],
      improvement_status: ["text", "character varying"],
      source_status: ["text", "character varying"],
      record_status: ["text", "character varying"],
      application_received_date: ["text", "character varying", "date", "timestamp without time zone", "timestamp with time zone"],
      permit_issue_date: ["text", "character varying", "date", "timestamp without time zone", "timestamp with time zone"],
      permit_close_date: ["text", "character varying", "date", "timestamp without time zone", "timestamp with time zone"],
      parcel_identifier: ["text", "character varying"],
      unnormalized_address: ["text", "character varying"],
      city_name: ["text", "character varying"],
      contractor_company_id: ["text", "character varying"],
      contractor_name: ["text", "character varying"]
    },
    company_profile_view: {
      company_id: ["text", "character varying"],
      name: ["text", "character varying"],
      document_number: ["text", "character varying"],
      status: ["text", "character varying"],
      filing_type: ["text", "character varying"],
      filed_date: ["text", "character varying", "date", "timestamp without time zone", "timestamp with time zone"]
    },
    address_profile_view: {
      address_id: ["text", "character varying"],
      property_id: ["text", "character varying"],
      unnormalized_address: ["text", "character varying"],
      city_name: ["text", "character varying"]
    },
    properties: {
      property_id: ["text", "character varying"],
      parcel_identifier: ["text", "character varying"],
      source_payload: ["jsonb"]
    },
    parcels: {
      parcel_id: ["text", "character varying"],
      property_id: ["text", "character varying"],
      parcel_identifier: ["text", "character varying"],
      source_payload: ["jsonb"]
    },
    ownerships: {
      ownership_id: ["text", "character varying"],
      property_id: ["text", "character varying"],
      owned_by: ["text", "character varying"],
      property_ownership_structure: ["text", "character varying"],
      source_payload: ["jsonb"]
    },
    property_improvements: {
      property_improvement_id: ["text", "character varying"],
      property_id: ["text", "character varying"],
      permit_number: ["text", "character varying"],
      contractor_company_id: ["text", "character varying"],
      source_payload: ["jsonb"]
    },
    business_registrations: {
      business_registration_id: ["text", "character varying"],
      company_id: ["text", "character varying"],
      document_number: ["text", "character varying"],
      source_payload: ["jsonb"]
    },
    business_reputation_profiles: {
      business_reputation_profile_id: ["text", "character varying"],
      company_id: ["text", "character varying"],
      bbb_rating: ["text", "character varying"],
      review_average_rating: ["numeric", "integer", "double precision", "real"],
      complaint_count: ["integer", "bigint", "numeric"],
      source_payload: ["jsonb"]
    },
    business_reputation_complaints: {
      complaint_id: ["text", "character varying"],
      business_reputation_profile_id: ["text", "character varying"],
      company_id: ["text", "character varying"],
      summary: ["text", "character varying"],
      status: ["text", "character varying"],
      source_payload: ["jsonb"]
    },
    business_reputation_reviews: {
      review_id: ["text", "character varying"],
      business_reputation_profile_id: ["text", "character varying"],
      company_id: ["text", "character varying"],
      review_average_rating: ["numeric", "integer", "double precision", "real"],
      source_payload: ["jsonb"]
    },
    contractor_quality_scores: {
      contractor_quality_score_id: ["text", "character varying"],
      business_reputation_profile_id: ["text", "character varying"],
      company_id: ["text", "character varying"],
      score: ["numeric", "integer", "double precision", "real"],
      source_payload: ["jsonb"]
    },
    addresses: {
      address_id: ["text", "character varying"],
      property_id: ["text", "character varying"],
      unnormalized_address: ["text", "character varying"],
      city_name: ["text", "character varying"],
      source_payload: ["jsonb"]
    }
  }
};

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, skipped: false, resource: CONTRACT.resource, message: messageOf(error) }, null, 2));
  process.exit(1);
});

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const required = process.argv.includes("--required") || process.env.REQUIRE_LIVE_QUERY_DB === "1";

  if (!databaseUrl || databaseUrl.trim().length === 0) {
    const message = `DATABASE_URL is not set. Skipping live ${CONTRACT.resource} validation.`;
    if (required) {
      console.error(JSON.stringify({ ok: false, skipped: false, required: true, message }, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: true, skipped: true, required: false, message }, null, 2));
    return;
  }

  const { neon } = requireFromDataSource("@neondatabase/serverless");
  const sql = neon(databaseUrl);

  const checks = [
    ...(await Promise.all(CONTRACT.views.map((name) => countSurface(sql, name, "view")))),
    ...(await Promise.all(CONTRACT.tables.map((name) => countSurface(sql, name, "table")))),
    ...(await Promise.all(
      Object.entries(CONTRACT.columns).flatMap(([surfaceName, columns]) =>
        Object.entries(columns).map(([columnName, types]) => columnContractCheck(sql, surfaceName, columnName, types))
      )
    )),
    ...(await Promise.all(CONTRACT.sourcePayloadTables.map((name) => sourcePayloadCheck(sql, name))))
  ];

  const byName = new Map(checks.map((check) => [check.name, check]));
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
    sourcePayloadTables: checks.filter((check) => check.kind === "source_payload" && check.ok).length
  };
  const missing = checks.filter((check) => !check.ok).map((check) => check.name);
  const report = {
    resource: CONTRACT.resource,
    envVar: CONTRACT.envVar,
    ready: missing.length === 0 && coverage.properties > 0 && coverage.permits > 0,
    coverage,
    checks,
    missing
  };

  console.log(JSON.stringify({ ok: report.ready, skipped: false, report }, null, 2));
  if (!report.ready) process.exit(1);
}

async function countSurface(sql, name, kind) {
  try {
    const rows = await sql(`select count(*)::int as count from ${name}`);
    return { name, kind, ok: true, count: numberValue(rows[0]?.count) };
  } catch (error) {
    return { name, kind, ok: false, message: messageOf(error) };
  }
}

async function sourcePayloadCheck(sql, tableName) {
  const name = `${tableName}.source_payload`;
  try {
    const rows = await sql`
      select count(*)::int as count
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = 'source_payload'
    `;
    const count = numberValue(rows[0]?.count);
    return {
      name,
      kind: "source_payload",
      ok: count > 0,
      count,
      message: count > 0 ? undefined : `Missing source_payload column on ${tableName}`
    };
  } catch (error) {
    return { name, kind: "source_payload", ok: false, message: messageOf(error) };
  }
}

async function columnContractCheck(sql, surfaceName, columnName, types) {
  const name = `${surfaceName}.${columnName}`;
  try {
    const rows = await sql`
      select data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${surfaceName}
        and column_name = ${columnName}
      limit 1
    `;
    const row = rows[0];
    if (!row) {
      return { name, kind: "column", ok: false, message: `Missing column ${name}` };
    }
    const dataType = String(row.data_type || "").toLowerCase();
    const ok = types.map((type) => type.toLowerCase()).includes(dataType);
    return {
      name,
      kind: "column",
      ok,
      message: ok ? undefined : `Column ${name} expected ${types.join(" | ")} but found ${dataType}`
    };
  } catch (error) {
    return { name, kind: "column", ok: false, message: messageOf(error) };
  }
}

function numberValue(value) {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

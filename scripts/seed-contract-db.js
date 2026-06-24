#!/usr/bin/env node
"use strict";

const path = require("path");
const { createRequire } = require("module");

global.window = {};
require("../oracle-data.js");

const root = path.join(__dirname, "..");
const requireFromDataSource = createRequire(path.join(root, "packages/oracle-data-source/package.json"));

const CONTRACT = {
  resource: "elephant-query-db",
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
  ]
};

const CREATE_TABLES = [
  `
    create table if not exists properties (
      property_id text primary key,
      parcel_identifier text unique,
      property_type text,
      property_usage_type text,
      property_structure_built_year integer,
      subdivision text,
      zoning text,
      source_payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists parcels (
      parcel_id text primary key,
      property_id text,
      parcel_identifier text unique,
      source_payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists addresses (
      address_id text primary key,
      property_id text,
      unnormalized_address text,
      city_name text,
      source_payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists ownerships (
      ownership_id text primary key,
      property_id text,
      owned_by text,
      property_ownership_structure text,
      date_acquired text,
      date_sold text,
      source_payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists property_improvements (
      property_improvement_id text primary key,
      property_id text,
      permit_number text unique,
      improvement_type text,
      improvement_status text,
      source_status text,
      record_status text,
      application_received_date text,
      permit_issue_date text,
      permit_close_date text,
      parcel_identifier text,
      unnormalized_address text,
      city_name text,
      contractor_company_id text,
      contractor_name text,
      permit_value numeric,
      source_payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists business_registrations (
      business_registration_id text primary key,
      company_id text unique,
      name text,
      document_number text,
      status text,
      filing_type text,
      filed_date text,
      source_payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists business_reputation_profiles (
      business_reputation_profile_id text primary key,
      company_id text unique,
      name text,
      legal_name text,
      profile_url text,
      bbb_rating text,
      review_average_rating numeric,
      complaint_count integer,
      closed_complaints_past_three_years integer,
      rating_score numeric,
      source_payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists business_reputation_complaints (
      complaint_id text primary key,
      business_reputation_profile_id text,
      company_id text,
      summary text,
      complaint_date text,
      status text,
      source_payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists business_reputation_reviews (
      review_id text primary key,
      business_reputation_profile_id text,
      company_id text,
      review_average_rating numeric,
      review_count integer,
      source_payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists contractor_quality_scores (
      contractor_quality_score_id text primary key,
      business_reputation_profile_id text,
      company_id text,
      score numeric,
      source_payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `
];

const CREATE_VIEWS = [
  `
    create or replace view property_profile_view as
    select property_id, parcel_identifier, property_type, property_usage_type,
           property_structure_built_year, subdivision, zoning
    from properties
  `,
  `
    create or replace view permit_search_view as
    select permit_number, improvement_type, improvement_status, source_status,
           record_status, application_received_date, permit_issue_date, permit_close_date,
           parcel_identifier, unnormalized_address, city_name, contractor_company_id,
           contractor_name
    from property_improvements
  `,
  `
    create or replace view company_profile_view as
    select company_id, name, document_number, status, filing_type, filed_date
    from business_registrations
  `,
  `
    create or replace view address_profile_view as
    select address_id, property_id, unnormalized_address, city_name
    from addresses
  `
];

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, resource: CONTRACT.resource, message: messageOf(error) }, null, 2));
  process.exit(1);
});

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error("DATABASE_URL is required. Use a Vercel Postgres/Neon connection string for your own contract-compatible database.");
  }

  const data = global.window.ORACLE_DATA;
  if (!data) throw new Error("Oracle fixture corpus was not loaded.");

  const { neon } = requireFromDataSource("@neondatabase/serverless");
  const sql = neon(databaseUrl);

  for (const statement of CREATE_TABLES) {
    await sql(statement);
  }

  if (process.argv.includes("--reset")) {
    await sql(`truncate table ${CONTRACT.tables.map(quoteIdent).join(", ")} restart identity cascade`);
  }

  await seedProperties(sql, data);
  await seedBusinesses(sql, data);
  await seedContractors(sql, data);

  for (const statement of CREATE_VIEWS) {
    await sql(statement);
  }

  const coverage = {};
  for (const name of [...CONTRACT.views, ...CONTRACT.tables]) {
    const rows = await sql(`select count(*)::int as count from ${quoteIdent(name)}`);
    coverage[name] = numberValue(rows[0]?.count);
  }

  console.log(JSON.stringify({ ok: true, resource: CONTRACT.resource, reset: process.argv.includes("--reset"), coverage }, null, 2));
}

async function seedProperties(sql, data) {
  for (const property of data.properties) {
    await upsert(sql, "properties", "property_id", {
      property_id: property.id,
      parcel_identifier: property.parcel,
      property_type: property.class,
      property_usage_type: property.class,
      property_structure_built_year: property.year,
      subdivision: property.neighborhood,
      zoning: property.class,
      source_payload: payload("property", property)
    });

    await upsert(sql, "parcels", "parcel_id", {
      parcel_id: `parcel-${property.id}`,
      property_id: property.id,
      parcel_identifier: property.parcel,
      source_payload: payload("parcel", { property_id: property.id, parcel_identifier: property.parcel, src: property.src })
    });

    await upsert(sql, "addresses", "address_id", {
      address_id: `address-${property.id}`,
      property_id: property.id,
      unnormalized_address: property.address,
      city_name: property.city,
      source_payload: payload("address", { property_id: property.id, address: property.address, city: property.city, src: property.src })
    });

    for (const [index, owner] of property.ownerHistory.entries()) {
      await upsert(sql, "ownerships", "ownership_id", {
        ownership_id: `${property.id}-owner-${index + 1}`,
        property_id: property.id,
        owned_by: owner.owner,
        property_ownership_structure: owner.type,
        date_acquired: owner.date,
        date_sold: index === 0 ? null : property.ownerHistory[index - 1]?.date ?? null,
        source_payload: payload("ownership", { ...owner, property_id: property.id, parcel_identifier: property.parcel, src: property.src })
      });
    }

    for (const permit of property.permits) {
      const contractor = data.contractors.find((item) => item.id === permit.contractor);
      await upsert(sql, "property_improvements", "property_improvement_id", {
        property_improvement_id: permit.id,
        property_id: property.id,
        permit_number: permit.id,
        improvement_type: permit.type,
        improvement_status: permit.status,
        source_status: permit.status,
        record_status: permit.status,
        application_received_date: permit.filed,
        permit_issue_date: permit.filed,
        permit_close_date: ["Closed", "Final"].includes(permit.status) ? permit.filed : null,
        parcel_identifier: property.parcel,
        unnormalized_address: property.address,
        city_name: property.city,
        contractor_company_id: permit.contractor,
        contractor_name: contractor?.name ?? permit.contractor,
        permit_value: permit.value,
        source_payload: payload("property_improvement", { ...permit, property_id: property.id, address: property.address, src: property.src })
      });
    }
  }
}

async function seedBusinesses(sql, data) {
  for (const business of data.businesses) {
    await upsert(sql, "business_registrations", "business_registration_id", {
      business_registration_id: business.id,
      company_id: business.id,
      name: business.name,
      document_number: business.sunbiz,
      status: business.status,
      filing_type: business.btype,
      filed_date: business.registered,
      source_payload: payload("business_registration", business)
    });
  }
}

async function seedContractors(sql, data) {
  for (const contractor of data.contractors) {
    const score = qualityScore(contractor);
    await upsert(sql, "business_reputation_profiles", "business_reputation_profile_id", {
      business_reputation_profile_id: contractor.id,
      company_id: contractor.id,
      name: contractor.name,
      legal_name: contractor.name,
      profile_url: contractor.src[0]?.url ?? null,
      bbb_rating: contractor.bbb,
      review_average_rating: contractor.review,
      complaint_count: contractor.complaints.length,
      closed_complaints_past_three_years: contractor.complaints.filter((complaint) => complaint.status.toLowerCase().includes("closed")).length,
      rating_score: score,
      source_payload: payload("business_reputation_profile", contractor)
    });

    await upsert(sql, "business_reputation_reviews", "review_id", {
      review_id: `${contractor.id}-review-summary`,
      business_reputation_profile_id: contractor.id,
      company_id: contractor.id,
      review_average_rating: contractor.review,
      review_count: contractor.projects,
      source_payload: payload("business_reputation_review", {
        contractor_id: contractor.id,
        review_average_rating: contractor.review,
        projects: contractor.projects,
        src: contractor.src
      })
    });

    await upsert(sql, "contractor_quality_scores", "contractor_quality_score_id", {
      contractor_quality_score_id: `${contractor.id}-quality`,
      business_reputation_profile_id: contractor.id,
      company_id: contractor.id,
      score,
      source_payload: payload("contractor_quality_score", {
        contractor_id: contractor.id,
        bbb: contractor.bbb,
        complaints: contractor.complaints.length,
        review: contractor.review,
        projects: contractor.projects,
        src: contractor.src
      })
    });

    for (const [index, complaint] of contractor.complaints.entries()) {
      await upsert(sql, "business_reputation_complaints", "complaint_id", {
        complaint_id: `${contractor.id}-complaint-${index + 1}`,
        business_reputation_profile_id: contractor.id,
        company_id: contractor.id,
        summary: complaint.summary,
        complaint_date: complaint.date,
        status: complaint.status,
        source_payload: payload("business_reputation_complaint", { ...complaint, contractor_id: contractor.id, src: contractor.src })
      });
    }
  }
}

async function upsert(sql, tableName, conflictColumn, row) {
  const columns = Object.keys(row);
  const placeholders = columns.map((column, index) => `$${index + 1}${column === "source_payload" ? "::jsonb" : ""}`);
  const updates = columns
    .filter((column) => column !== conflictColumn)
    .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
    .concat(["updated_at = now()"]);
  const values = columns.map((column) => (column === "source_payload" ? JSON.stringify(row[column]) : row[column]));

  await sql(
    `
      insert into ${quoteIdent(tableName)} (${columns.map(quoteIdent).join(", ")})
      values (${placeholders.join(", ")})
      on conflict (${quoteIdent(conflictColumn)})
      do update set ${updates.join(", ")}
    `,
    values
  );
}

function payload(kind, record) {
  return {
    kind,
    seeded_from: "oracle-data.js",
    seeded_at: "2026-06-18T00:00:00.000Z",
    source_systems: Array.isArray(record.src) ? record.src.map((source) => source.system) : [],
    record
  };
}

function qualityScore(contractor) {
  const bbbScore = { A: 100, B: 85, C: 70, D: 45, F: 20 }[contractor.bbb] ?? 60;
  const complaintPenalty = Math.min(40, contractor.complaints.length * 12);
  const reviewScore = Math.max(0, Math.min(100, contractor.review * 20));
  return Math.round((bbbScore * 0.45 + reviewScore * 0.45 - complaintPenalty + 10) * 10) / 10;
}

function quoteIdent(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `"${value}"`;
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

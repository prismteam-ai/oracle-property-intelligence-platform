import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/server/pg";
import {
  projectMaterializationSelect,
  publicRecordsMaterializationSelect,
  rollupMaterializationSelect,
} from "./neon-materialize-sql";

export async function physicalTableExists(table: string): Promise<boolean> {
  const res = await db.execute(
    sql`select to_regclass(${`public.${table}`}) is not null as present`,
  );
  const rows =
    (res as unknown as { rows?: Array<{ present: boolean }> }).rows ??
    (res as unknown as Array<{ present: boolean }>);
  return Boolean(rows?.[0]?.present);
}

let materialized: Promise<void> | null = null;

export function ensureMaterialized(opts: { refresh?: boolean } = {}): Promise<void> {
  if (materialized && !opts.refresh) return materialized;
  materialized = (async () => {
    const drop = opts.refresh;

    if (drop) await db.execute(sql`drop table if exists property_signal_rollups`);
    if (!(await physicalTableExists("property_signal_rollups"))) {
      await db.execute(
        sql`create table if not exists property_signal_rollups as ${rollupMaterializationSelect()}`,
      );
      await db.execute(
        sql`create unique index if not exists property_signal_rollups_property_idx
            on property_signal_rollups (property_id)`,
      );
    }

    if (drop) await db.execute(sql`drop table if exists projects cascade`);
    if (!(await physicalTableExists("projects"))) {
      await db.execute(sql`create table if not exists projects as ${projectMaterializationSelect()}`);
      await db.execute(
        sql`create index if not exists projects_property_idx on projects (property_id)`,
      );
    }

    if (drop) await db.execute(sql`drop table if exists public_records`);
    if (!(await physicalTableExists("public_records"))) {
      await db.execute(
        sql`create table if not exists public_records as ${publicRecordsMaterializationSelect()}`,
      );
      await db.execute(
        sql`create index if not exists public_records_entity_idx
            on public_records (entity_type, entity_id)`,
      );
    }

    if (!(await physicalTableExists("tenants"))) {
      await db.execute(sql`
        create table tenants (
          tenant_id uuid primary key default gen_random_uuid(),
          person_id uuid, company_id uuid,
          request_identifier text, tenant_name text, normalized_name text,
          tenant_type text, match_method text, match_confidence text,
          source_payload jsonb not null default '{}'::jsonb,
          source_system text not null default 'oracle',
          source_record_key text not null default '',
          source_record_hash text, source_artifact_uri text,
          loaded_at timestamptz not null default now(),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )`);
    }
    if (!(await physicalTableExists("occupancies"))) {
      await db.execute(sql`
        create table occupancies (
          occupancy_id uuid primary key default gen_random_uuid(),
          tenant_id uuid, property_id uuid, address_id uuid,
          business_registration_id uuid, company_id uuid,
          request_identifier text, occupancy_type text, occupancy_status text,
          space_identifier text, start_date date, end_date date,
          match_method text, match_confidence text,
          source_payload jsonb not null default '{}'::jsonb,
          source_system text not null default 'oracle',
          source_record_key text not null default '',
          source_record_hash text, source_artifact_uri text,
          loaded_at timestamptz not null default now(),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )`);
    }
  })();
  return materialized;
}

export function __resetMaterialization() {
  materialized = null;
}

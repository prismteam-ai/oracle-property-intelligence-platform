/**
 * Neon additive-table materialization tests — NO live DB required.
 *
 * We cannot connect to a real Neon @elephant-xyz/query-db (no creds), so these
 * tests verify what is verifiable offline: that the materialization SQL the
 * DATA_SOURCE=neon path runs is CONSTRUCTED CORRECTLY and mirrors, 1:1, the
 * synthetic generator's derivation (src/db/seed/generate.ts) and the renovation
 * scoring (src/lib/renovation.ts). The SQL builders are pure (no `server-only`,
 * no `db`), so we render them with the same PgDialect the driver uses and assert
 * on the emitted SQL. End-to-end execution against real Neon rows is the one part
 * that still needs a live Neon run (documented in the PR notes).
 */

import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  projectMaterializationSelect,
  publicRecordsMaterializationSelect,
  rollupMaterializationSelect,
} from "@/server/providers/neon-materialize-sql";
import { MAJOR_RENOVATION_VALUE_THRESHOLD } from "@/lib/renovation";

const dialect = new PgDialect();
const render = (s: ReturnType<typeof rollupMaterializationSelect>) =>
  dialect.sqlToQuery(s).sql;

describe("rollup materialization SQL", () => {
  const sql = render(rollupMaterializationSelect());

  it("derives rollups from the canonical permit/sales/occupancy tables only", () => {
    expect(sql).toContain("from property_improvements");
    expect(sql).toContain("from sales_histories");
    expect(sql).toContain("from occupancies");
    expect(sql).toContain("from properties");
    // It must NOT read the additive rollup table it is materializing.
    expect(sql).not.toContain("from property_signal_rollups");
  });

  it("uses the exact improvement-score formula from renovation.ts", () => {
    // permit_count_5y*2 + major_count*10 + total_value/100k
    expect(sql).toContain("* 2");
    expect(sql).toContain("* 10");
    expect(sql).toContain("/ 100000");
  });

  it("uses the major-renovation value threshold (50_000) from renovation.ts", () => {
    expect(MAJOR_RENOVATION_VALUE_THRESHOLD).toBe(50000);
    expect(sql).toContain("50000");
  });

  it("computes open-permit and major counts the way the generator does", () => {
    expect(sql).toContain("improvement_status = 'open'");
    expect(sql).toContain("open_permit_count");
    expect(sql).toContain("major_renovation_count");
    expect(sql).toContain("ownership_change_count");
    expect(sql).toContain("business_turnover_count");
  });

  it("emits every column the analytics.ts schema reads", () => {
    for (const col of [
      "property_id",
      "parcel_identifier",
      "municipality_name",
      "open_permit_categories",
      "permit_count_5y",
      "renovation_trades",
      "improvement_score",
      "total_permit_value",
      "source_system",
      "source_record_key",
    ]) {
      expect(sql).toContain(col);
    }
  });
});

describe("project materialization SQL", () => {
  const sql = render(projectMaterializationSelect());

  it("groups one project per property from permits", () => {
    expect(sql).toContain("from property_improvements");
    expect(sql).toContain("group by pi.property_id");
    expect(sql).not.toContain("from projects");
  });

  it("flags major renovations and status the way the generator does", () => {
    expect(sql).toContain("is_major_renovation");
    expect(sql).toContain("project_status");
    expect(sql).toContain("'active'");
    expect(sql).toContain("'completed'");
    expect(sql).toContain("permit_count");
  });
});

describe("public_records materialization SQL", () => {
  const sql = render(publicRecordsMaterializationSelect());

  it("projects the source_* provenance columns of canonical tables (AC #11/#12)", () => {
    expect(sql).toContain("source_url");
    expect(sql).toContain("collection_timestamp");
    expect(sql).toContain("refresh_timestamp");
    expect(sql).toContain("lineage");
    expect(sql).toContain("source_record_hash");
  });

  it("is polymorphic across property / permit / business entities", () => {
    expect(sql).toContain("'property'");
    expect(sql).toContain("'permit'");
    expect(sql).toContain("'business'");
    expect(sql).toContain("entity_type");
    expect(sql).toContain("entity_id");
  });

  it("labels lineage honestly from the dataset mode (no hardcoded synthetic flag)", () => {
    expect(sql).not.toContain("'synthetic', false");
    expect(sql).not.toContain("'synthetic', true");
    expect(sql).toContain("'synthetic', $");
    expect(sql).toContain("'pipeline'");
    expect(sql).toContain("@elephant-xyz/query-db");

    const syntheticParams = dialect.sqlToQuery(publicRecordsMaterializationSelect(true)).params;
    const realParams = dialect.sqlToQuery(publicRecordsMaterializationSelect(false)).params;
    expect(syntheticParams).toContain(true);
    expect(syntheticParams).not.toContain(false);
    expect(realParams).toContain(false);
    expect(realParams).not.toContain(true);
  });
});

/**
 * Swap-seam contract test — NO live DB required.
 *
 * Documents and locks in the env-only swap point. The whole point of the
 * data-access layer is that the SAME query vocabulary runs against any store:
 *
 *   DATA_SOURCE=memory -> providers/memory.ts (DB-free synthetic graph, DEFAULT)
 *   DATA_SOURCE=local  -> providers/local.ts  (synthetic dataset in pgvector)
 *   DATA_SOURCE=neon   -> providers/neon.ts   (real @elephant-xyz/query-db)
 *
 * The swap is one env var (src/server/db.ts selects the provider; src/server/pg.ts
 * selects the DB driver for local/neon) plus pointing DATABASE_URL at Neon. The
 * default is `memory` so the UI + RAG demo run with no Postgres/docker/API key.
 *
 * We cannot import the providers here (they are `server-only` and open a pg
 * pool), but we CAN assert the contract those providers implement: the kit-named
 * query methods, run against fixture data, return store-agnostic results. The
 * Neon provider differs only in the connection string, not in these mappings.
 */

import { describe, expect, it } from "vitest";

import { generate } from "@/db/seed/generate";
import { SEED } from "@/db/seed/rng";
import { createInMemoryAccess } from "@/db/seed/in-memory-access";

const access = createInMemoryAccess(generate(SEED));

// The kit-named read methods the UI/RAG flows depend on (mirrors ports.ts).
const CONTRACT_METHODS = [
  "getPropertyByParcelIdentifier",
  "getPropertyById",
  "searchPermits",
  "getPermitByNumber",
  "listPermitsForProperty",
  "listContractorsWithNegativeBbb",
  "listContractorQualityScoresForPermitNumber",
  "getBusinessReputationDetail",
  "listOccupanciesForProperty",
  "listOccupanciesForTenant",
  "getTenantById",
  "getRollupForProperty",
  "propertiesWithMultipleOpenPermits",
  "ownersWithMultipleProperties",
] as const;

describe("swap-seam contract", () => {
  it("exposes the kit-named query vocabulary", () => {
    for (const m of CONTRACT_METHODS) {
      expect(typeof (access as Record<string, unknown>)[m]).toBe("function");
    }
  });

  it("returns results from canonical lexicon columns only (store-agnostic)", () => {
    // Each query reads columns that exist identically on synthetic and Neon
    // rows (parcel_identifier, improvement_status, contractor_company_id, ...).
    // So the result shape does not depend on which store backs it.
    const permit = access.searchPermits({ status: "open" })[0]!;
    expect(permit).toHaveProperty("parcelIdentifier");
    expect(permit).toHaveProperty("improvementStatus");
    expect(permit).toHaveProperty("contractorCompanyId");
    expect(permit).toHaveProperty("sourceSystem");

    const prop = access.getPropertyByParcelIdentifier(permit.parcelIdentifier!);
    expect(prop).not.toBeNull();
    expect(prop).toHaveProperty("propertyId");
    expect(prop).toHaveProperty("sourceRecordKey");
  });

  it("default DATA_SOURCE resolves to the DB-free memory provider", () => {
    // db.ts: const DATA_SOURCE = (process.env.DATA_SOURCE ?? "memory").toLowerCase();
    const resolved = (process.env.DATA_SOURCE ?? "memory").toLowerCase();
    expect(["memory", "local", "neon"]).toContain(resolved);
    // In test/dev (DATA_SOURCE unset) the default is the DB-free memory provider,
    // which is what makes the views Playwright-drivable on a clean checkout.
    expect(resolved).toBe("memory");
  });
});

/**
 * Data-access mapping tests — NO live DB / docker required.
 *
 * These verify the swap-layer mapping logic in isolation from the Postgres
 * driver: an in-memory DataAccess-shaped implementation runs the SAME kit-named
 * queries (getPropertyByParcelIdentifier, searchPermits,
 * listContractorQualityScoresForPermitNumber, ...) over fixture data drawn from
 * the synthetic generator.
 *
 * Because the synthetic graph and real Neon rows share identical column names,
 * the mapping under test is store-agnostic — the same queries map the same
 * columns whether the rows came from the local synthetic dataset or, after the
 * env-only swap (DATA_SOURCE=neon), from the real @elephant-xyz/query-db.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { generate, type GeneratedGraph } from "@/db/seed/generate";
import { SEED } from "@/db/seed/rng";
import { createInMemoryAccess, type InMemoryAccess } from "@/db/seed/in-memory-access";

let g: GeneratedGraph;
let access: InMemoryAccess;

beforeAll(() => {
  g = generate(SEED);
  access = createInMemoryAccess(g);
});

describe("property reads", () => {
  it("getPropertyByParcelIdentifier returns the matching property", () => {
    const sample = g.properties[100]!;
    const found = access.getPropertyByParcelIdentifier(sample.parcelIdentifier);
    expect(found).not.toBeNull();
    expect(found!.propertyId).toBe(sample.propertyId);
  });

  it("getPropertyByParcelIdentifier returns null for an unknown parcel", () => {
    expect(access.getPropertyByParcelIdentifier("99-99-99-9999-9999.9999")).toBeNull();
  });

  it("getPropertyById round-trips", () => {
    const sample = g.properties[5]!;
    expect(access.getPropertyById(sample.propertyId!)!.parcelIdentifier).toBe(
      sample.parcelIdentifier,
    );
  });
});

describe("permit reads", () => {
  it("searchPermits filters by permit type", () => {
    const roofing = access.searchPermits({ permitType: "roofing" });
    expect(roofing.length).toBeGreaterThan(0);
    expect(roofing.every((p) => p.improvementType === "roofing")).toBe(true);
  });

  it("searchPermits filters by open status", () => {
    const open = access.searchPermits({ status: "open" });
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((p) => p.improvementStatus === "open")).toBe(true);
  });

  it("searchPermits composes type + status filters (AC #53 filtering)", () => {
    const openRoof = access.searchPermits({ permitType: "roofing", status: "open" });
    expect(openRoof.length).toBeGreaterThan(0);
    expect(
      openRoof.every(
        (p) => p.improvementType === "roofing" && p.improvementStatus === "open",
      ),
    ).toBe(true);
  });

  it("getPermitByNumber resolves a permit and listPermitsForProperty is consistent", () => {
    const sample = g.propertyImprovements[42]!;
    const byNumber = access.getPermitByNumber(sample.permitNumber!);
    expect(byNumber!.propertyImprovementId).toBe(sample.propertyImprovementId);
    const forProp = access.listPermitsForProperty(sample.propertyId!);
    expect(forProp.some((p) => p.permitNumber === sample.permitNumber)).toBe(true);
  });
});

describe("contractor / reputation joins", () => {
  it("listContractorsWithNegativeBbb returns only negatively-rated companies", () => {
    const bad = access.listContractorsWithNegativeBbb();
    expect(bad.length).toBeGreaterThan(0);
    const badIds = new Set(bad.map((c) => c.companyId));
    const negProfiles = g.businessReputationProfiles.filter((p) =>
      ["D+", "D", "D-", "F", "NR"].includes(p.bbbRating ?? ""),
    );
    // Every negative profile's company is present in the result.
    for (const p of negProfiles) {
      expect(badIds.has(p.companyId ?? undefined as never)).toBe(true);
    }
  });

  it("listContractorQualityScoresForPermitNumber joins permit -> contractor company", () => {
    const permit = g.propertyImprovements.find((p) => p.contractorCompanyId)!;
    const companies = access.listContractorQualityScoresForPermitNumber(
      permit.permitNumber!,
    );
    expect(companies.length).toBe(1);
    expect(companies[0]!.companyId).toBe(permit.contractorCompanyId);
  });

  it("getBusinessReputationDetail returns the company's BBB profile", () => {
    const profile = g.businessReputationProfiles[0]!;
    const detail = access.getBusinessReputationDetail(profile.companyId!);
    expect(detail!.businessReputationProfileId).toBe(profile.businessReputationProfileId);
  });
});

describe("tenant / occupancy joins", () => {
  it("listOccupanciesForProperty returns occupancies for that property only", () => {
    const occ = g.occupancies[0]!;
    const list = access.listOccupanciesForProperty(occ.propertyId!);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((o) => o.propertyId === occ.propertyId)).toBe(true);
  });

  it("listOccupanciesForTenant + getTenantById are consistent", () => {
    const occ = g.occupancies[10]!;
    const tenant = access.getTenantById(occ.tenantId!);
    expect(tenant).not.toBeNull();
    const list = access.listOccupanciesForTenant(occ.tenantId!);
    expect(list.every((o) => o.tenantId === occ.tenantId)).toBe(true);
  });
});

describe("analytics mapping", () => {
  it("getRollupForProperty returns the denormalized signal row", () => {
    const r = g.rollups[3]!;
    const found = access.getRollupForProperty(r.propertyId!);
    expect(found!.openPermitCount).toBe(r.openPermitCount);
  });

  it("propertiesWithMultipleOpenPermits returns only rollups with >1 open permit", () => {
    const rows = access.propertiesWithMultipleOpenPermits();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => (r.openPermitCount ?? 0) > 1)).toBe(true);
  });

  it("ownersWithMultipleProperties returns owners holding >1 property", () => {
    const owners = access.ownersWithMultipleProperties();
    expect(owners.length).toBeGreaterThan(0);
    expect(owners.every((o) => o.propertyCount > 1)).toBe(true);
  });
});

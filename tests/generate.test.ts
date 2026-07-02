/**
 * Generator tests — NO live DB / docker required.
 *
 * These exercise the disclosed synthetic generator purely in memory:
 *   - determinism (same seed => byte-identical graph; different seed => different)
 *   - production-like scale (record counts >= VOLUMES targets)
 *   - provenance on every row (source_system + source_record_key, + URLs)
 *   - force-the-demo guarantees (every demo inquiry has non-empty backing data)
 *   - engineered referential integrity (FK targets exist; rollups are coherent)
 */

import { beforeAll, describe, expect, it } from "vitest";

import { FORCE, VOLUMES, generate, type GeneratedGraph } from "@/db/seed/generate";
import { SEED } from "@/db/seed/rng";
import { NEGATIVE_BBB_RATINGS } from "@/db/seed/vocab";

// Generate once (it's deterministic and a little heavy) and reuse.
let g: GeneratedGraph;
beforeAll(() => {
  g = generate(SEED);
});

describe("determinism", () => {
  it("produces a byte-identical graph for the same seed", () => {
    const a = generate(SEED);
    const b = generate(SEED);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("produces stable UUIDs across rebuilds (stable deep links)", () => {
    const a = generate(SEED);
    const b = generate(SEED);
    expect(a.properties[0]!.propertyId).toEqual(b.properties[0]!.propertyId);
    expect(a.properties.at(-1)!.propertyId).toEqual(b.properties.at(-1)!.propertyId);
  });

  it("produces a different graph for a different seed", () => {
    const other = generate(SEED + 1);
    expect(other.properties[0]!.propertyId).not.toEqual(g.properties[0]!.propertyId);
  });
});

describe("production-like scale", () => {
  it("meets or exceeds the property target", () => {
    expect(g.properties.length).toBeGreaterThanOrEqual(VOLUMES.properties);
  });
  it("meets or exceeds the permit target (tens of thousands)", () => {
    expect(g.propertyImprovements.length).toBeGreaterThanOrEqual(VOLUMES.permits);
  });
  it("meets the contractor (BBB profile) target", () => {
    expect(g.businessReputationProfiles.length).toBeGreaterThanOrEqual(
      VOLUMES.contractors,
    );
  });
  it("meets the business (Sunbiz) target", () => {
    expect(g.businessRegistrations.length).toBeGreaterThanOrEqual(VOLUMES.businesses);
  });
  it("meets the occupancy target", () => {
    expect(g.occupancies.length).toBeGreaterThanOrEqual(VOLUMES.occupancies);
  });
  it("meets the complaint target", () => {
    expect(g.businessReputationComplaints.length).toBeGreaterThanOrEqual(
      VOLUMES.complaints,
    );
  });
  it("meets the review target", () => {
    expect(g.businessReputationReviews.length).toBeGreaterThanOrEqual(VOLUMES.reviews);
  });
  it("emits a parcel + address + rollup per property", () => {
    expect(g.parcels.length).toBe(g.properties.length);
    expect(g.addresses.length).toBe(g.properties.length);
    expect(g.rollups.length).toBe(g.properties.length);
  });
});

describe("provenance on every row (AC #11, #12)", () => {
  // Every lexicon-shaped row carries source_system + source_record_key.
  const tablesWithProvenance: (keyof GeneratedGraph)[] = [
    "people",
    "companies",
    "addresses",
    "parcels",
    "properties",
    "ownerships",
    "taxes",
    "salesHistories",
    "propertyValuations",
    "propertyImprovements",
    "permitContacts",
    "businessRegistrations",
    "businessRegistrationParties",
    "businessRegistrationAddresses",
    "businessReputationProfiles",
    "businessReputationReviews",
    "businessReputationComplaints",
    "businessReputationComplaintEvents",
    "contractorQualityScores",
    "tenants",
    "occupancies",
    "projects",
    "projectPermits",
    "projectContractors",
    "rollups",
    "publicRecords",
  ];

  it.each(tablesWithProvenance)("every %s row has source_system + source_record_key", (key) => {
    const rows = g[key] as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.sourceSystem, `${key} missing sourceSystem`).toBeTruthy();
      expect(row.sourceRecordKey, `${key} missing sourceRecordKey`).toBeTruthy();
    }
  });

  it("source_record_key is unique within each table (the swap unique key)", () => {
    for (const key of tablesWithProvenance) {
      const rows = g[key] as Array<{ sourceSystem?: string; sourceRecordKey?: string }>;
      const keys = rows.map((r) => `${r.sourceSystem}::${r.sourceRecordKey}`);
      expect(new Set(keys).size, `${key} has duplicate (source_system, source_record_key)`).toBe(
        keys.length,
      );
    }
  });

  it("permits carry a real Accela source_url, parcels/properties a leepa artifact uri", () => {
    expect(g.propertyImprovements[0]!.sourceUrl).toMatch(/accela\.com/);
    expect(g.parcels[0]!.sourceArtifactUri).toMatch(/leepa\.org/);
    expect(g.properties[0]!.sourceArtifactUri).toMatch(/leepa\.org/);
  });

  it("public_records ledger discloses synthetic lineage", () => {
    expect(g.publicRecords.length).toBeGreaterThan(0);
    for (const pr of g.publicRecords.slice(0, 50)) {
      expect((pr.lineage as Record<string, unknown>).synthetic).toBe(true);
      expect(pr.sourceUrl).toBeTruthy();
      expect(pr.collectionTimestamp).toBeInstanceOf(Date);
    }
  });
});

describe("force-the-demo: every demo inquiry has non-empty backing data", () => {
  function openByProperty(graph: GeneratedGraph): Map<string, number> {
    const m = new Map<string, number>();
    for (const p of graph.propertyImprovements) {
      if (p.improvementStatus === "open") {
        m.set(p.propertyId!, (m.get(p.propertyId!) ?? 0) + 1);
      }
    }
    return m;
  }

  it("demo #1: properties with >1 open permit", () => {
    const multi = [...openByProperty(g).values()].filter((n) => n > 1).length;
    expect(multi).toBeGreaterThanOrEqual(FORCE.hotPropertiesMultiOpen);
  });

  it("demo #2: properties with an open roofing permit", () => {
    const n = g.propertyImprovements.filter(
      (p) => p.improvementStatus === "open" && p.improvementType === "roofing",
    ).length;
    expect(n).toBeGreaterThanOrEqual(FORCE.openRoofing);
  });

  it("demo #3: properties with an open electrical permit", () => {
    const n = g.propertyImprovements.filter(
      (p) => p.improvementStatus === "open" && p.improvementType === "electrical",
    ).length;
    expect(n).toBeGreaterThanOrEqual(FORCE.openElectrical);
  });

  it("demo #4-6,#8: properties with a major renovation", () => {
    const n = g.rollups.filter((r) => (r.majorRenovationCount ?? 0) > 0).length;
    expect(n).toBeGreaterThanOrEqual(FORCE.majorRenovations);
  });

  it("demo #11-13: contractors with a negative BBB rating", () => {
    const neg = g.businessReputationProfiles.filter((p) =>
      (NEGATIVE_BBB_RATINGS as readonly string[]).includes(p.bbbRating ?? ""),
    );
    expect(neg.length).toBeGreaterThan(0);
    // BBB rating drives complaint volume: negative profiles average more complaints.
    const avgNegComplaints =
      neg.reduce((s, p) => s + (p.complaintCount ?? 0), 0) / neg.length;
    expect(avgNegComplaints).toBeGreaterThan(2);
  });

  it("demo #15: owners with multiple properties", () => {
    const counts = new Map<string, number>();
    for (const o of g.ownerships) {
      if (o.ownerCompanyId) {
        counts.set(o.ownerCompanyId, (counts.get(o.ownerCompanyId) ?? 0) + 1);
      }
    }
    const multi = [...counts.values()].filter((n) => n > 1).length;
    expect(multi).toBeGreaterThan(5);
  });

  it("demo #16: tenants at multiple locations exist (occupancies populated)", () => {
    expect(g.occupancies.length).toBeGreaterThan(0);
    // At least some commercial occupancies have ENDED (turnover signal).
    const ended = g.occupancies.filter((o) => o.occupancyStatus === "ended").length;
    expect(ended).toBeGreaterThan(0);
  });

  it("demo #18: properties with business turnover", () => {
    const n = g.rollups.filter((r) => (r.businessTurnoverCount ?? 0) > 0).length;
    expect(n).toBeGreaterThan(0);
  });

  it("demo #13,#21: projects link permits and contractors", () => {
    expect(g.projects.length).toBeGreaterThan(0);
    expect(g.projectPermits.length).toBeGreaterThan(0);
    expect(g.projectContractors.length).toBeGreaterThan(0);
  });
});

describe("referential integrity", () => {
  it("every permit references an existing property and contractor company", () => {
    const propIds = new Set(g.properties.map((p) => p.propertyId));
    const companyIds = new Set(g.companies.map((c) => c.companyId));
    for (const p of g.propertyImprovements) {
      expect(propIds.has(p.propertyId ?? undefined)).toBe(true);
      expect(companyIds.has(p.contractorCompanyId ?? undefined)).toBe(true);
    }
  });

  it("every ownership references an existing person or company", () => {
    const personIds = new Set(g.people.map((p) => p.personId));
    const companyIds = new Set(g.companies.map((c) => c.companyId));
    for (const o of g.ownerships) {
      const ok =
        (o.ownerPersonId && personIds.has(o.ownerPersonId)) ||
        (o.ownerCompanyId && companyIds.has(o.ownerCompanyId));
      expect(Boolean(ok)).toBe(true);
    }
  });

  it("every BBB profile references an existing contractor company", () => {
    const companyIds = new Set(g.companies.map((c) => c.companyId));
    for (const p of g.businessReputationProfiles) {
      expect(companyIds.has(p.companyId ?? undefined)).toBe(true);
    }
  });

  it("every occupancy references an existing tenant and property", () => {
    const tenantIds = new Set(g.tenants.map((t) => t.tenantId));
    const propIds = new Set(g.properties.map((p) => p.propertyId));
    for (const o of g.occupancies) {
      expect(tenantIds.has(o.tenantId ?? undefined)).toBe(true);
      expect(propIds.has(o.propertyId ?? undefined)).toBe(true);
    }
  });

  it("rollup open_permit_count matches the actual open permits per property", () => {
    const open = new Map<string, number>();
    for (const p of g.propertyImprovements) {
      if (p.improvementStatus === "open") {
        open.set(p.propertyId!, (open.get(p.propertyId!) ?? 0) + 1);
      }
    }
    for (const r of g.rollups) {
      expect(r.openPermitCount).toBe(open.get(r.propertyId!) ?? 0);
    }
  });

  it("entity-resolution columns are populated (AC #9, #10)", () => {
    expect(g.tenants.every((t) => t.matchMethod && t.matchConfidence)).toBe(true);
    expect(g.occupancies.every((o) => o.matchMethod && o.matchConfidence)).toBe(true);
    expect(g.contractorQualityScores.every((q) => q.matchMethod)).toBe(true);
    // normalized join keys exist on companies and addresses.
    expect(g.companies.every((c) => c.normalizedName)).toBe(true);
    expect(g.addresses.every((a) => a.normalizedAddressHash)).toBe(true);
  });
});

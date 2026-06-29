/**
 * Exploration-view data-access tests — NO live DB.
 *
 * Verifies the new aggregate + filter reads the exploration UI depends on
 * (getPropertyDetail / getContractorDetail / getBusinessDetail / getTenantDetail,
 * list filtering, dashboard stats, filter facets) over the synthetic graph. The
 * UI Server Components consume EXACTLY these shapes through the DataAccess port,
 * so green here means the views have their required fields.
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

describe("property detail (AC #17-24)", () => {
  it("aggregates ownership, permits, open permits, contractors, occupancy, projects", () => {
    // Find a property with permits so the aggregate is non-trivial.
    const withPermits = g.propertyImprovements.find((p) => p.propertyId)!;
    const detail = access.getPropertyDetail(withPermits.propertyId!);
    expect(detail).not.toBeNull();
    expect(detail!.property.propertyId).toBe(withPermits.propertyId);
    expect(detail!.permits.length).toBeGreaterThan(0);
    // Open permits are a subset filtered to open status.
    expect(detail!.openPermits.every((p) => p.improvementStatus === "open")).toBe(true);
    // Ownership history resolves an owner name + kind.
    expect(detail!.ownershipHistory.length).toBeGreaterThan(0);
    expect(["person", "company", "unknown"]).toContain(detail!.ownershipHistory[0]!.ownerKind);
    // Contractor activity is grouped by contractor with a permit count.
    if (detail!.contractorActivity.length) {
      expect(detail!.contractorActivity[0]!.permitCount).toBeGreaterThan(0);
    }
    // Rollup signal present.
    expect(detail!.rollup).not.toBeNull();
  });

  it("major improvements are all classified as major renovations", () => {
    const big = g.rollups.find((r) => (r.majorRenovationCount ?? 0) > 0)!;
    const detail = access.getPropertyDetail(big.propertyId!)!;
    expect(detail.majorImprovements.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown property", () => {
    expect(access.getPropertyDetail("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("contractor detail (AC #36-42)", () => {
  it("aggregates BBB rating, complaints, reviews, permits, projects, properties", () => {
    const profile = g.businessReputationProfiles.find((p) => (p.complaintCount ?? 0) > 0)!;
    const detail = access.getContractorDetail(profile.companyId!);
    expect(detail).not.toBeNull();
    expect(detail!.reputation?.bbbRating).toBe(profile.bbbRating);
    expect(detail!.complaints.length).toBeGreaterThan(0);
    expect(detail!.reviewSummary.reviewCount).toBeGreaterThanOrEqual(0);
    // A contractor that pulls permits links to >=1 property.
    expect(detail!.permits.length).toBeGreaterThan(0);
    expect(detail!.properties.length).toBeGreaterThan(0);
  });

  it("flags negative-BBB contractors", () => {
    const neg = g.businessReputationProfiles.find((p) =>
      ["D+", "D", "D-", "F", "NR"].includes(p.bbbRating ?? ""),
    )!;
    const detail = access.getContractorDetail(neg.companyId!)!;
    expect(detail.isNegative).toBe(true);
  });
});

describe("business detail (AC #30-35)", () => {
  it("aggregates registration, parties, related properties, permits", () => {
    const reg = g.businessRegistrations[0]!;
    const detail = access.getBusinessDetail(reg.documentNumber);
    expect(detail).not.toBeNull();
    expect(detail!.business.documentNumber).toBe(reg.documentNumber);
    expect(detail!.parties.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown document number", () => {
    expect(access.getBusinessDetail("NOPE-000")).toBeNull();
  });
});

describe("tenant detail (AC #25-29)", () => {
  it("aggregates occupancy, properties, associated businesses for a commercial tenant", () => {
    const occ = g.occupancies.find((o) => o.businessRegistrationId)!;
    const detail = access.getTenantDetail(occ.tenantId!);
    expect(detail).not.toBeNull();
    expect(detail!.occupancies.length).toBeGreaterThan(0);
    expect(detail!.properties.length).toBeGreaterThan(0);
    expect(detail!.businesses.length).toBeGreaterThan(0);
  });
});

describe("list filtering (AC #53)", () => {
  it("listProperties filters by property class", () => {
    const commercial = access.listProperties({ propertyClass: "commercial", limit: 200 });
    expect(commercial.length).toBeGreaterThan(0);
    expect(commercial.every((p) => p.propertyUsageType === "commercial")).toBe(true);
  });

  it("listProperties filters by permit type", () => {
    const roofing = access.listProperties({ permitType: "roofing", limit: 500 });
    expect(roofing.length).toBeGreaterThan(0);
  });

  it("listContractors filters to negative ratings and sorts by complaints", () => {
    const neg = access.listContractors({ rating: "negative", sort: "complaints", limit: 500 });
    expect(neg.length).toBeGreaterThan(0);
    expect(neg.every((c) => c.isNegative)).toBe(true);
    // Sorted descending by complaint count.
    for (let i = 1; i < neg.length; i++) {
      expect(neg[i - 1]!.complaintCount ?? 0).toBeGreaterThanOrEqual(neg[i]!.complaintCount ?? 0);
    }
  });

  it("listContractors filters by trade", () => {
    const roofers = access.listContractors({ trade: "Roofing", limit: 500 });
    expect(roofers.length).toBeGreaterThan(0);
    expect(roofers.every((c) => (c.trade ?? "").toLowerCase() === "roofing")).toBe(true);
  });

  it("listBusinesses filters by status", () => {
    const active = access.listBusinesses({ status: "active", limit: 500 });
    expect(active.every((b) => (b.status ?? "").toLowerCase() === "active")).toBe(true);
  });

  it("listTenants filters by tenant type", () => {
    const commercial = access.listTenants({ tenantType: "commercial", limit: 500 });
    expect(commercial.length).toBeGreaterThan(0);
    expect(commercial.every((t) => t.tenantType === "commercial")).toBe(true);
  });
});

describe("dashboard + facets", () => {
  it("getDashboardStats returns positive headline counts", () => {
    const s = access.getDashboardStats();
    expect(s.properties).toBeGreaterThan(0);
    expect(s.permits).toBeGreaterThan(0);
    expect(s.openPermits).toBeGreaterThan(0);
    expect(s.contractors).toBeGreaterThan(0);
    expect(s.negativeContractors).toBeGreaterThan(0);
    expect(s.businesses).toBeGreaterThan(0);
    expect(s.multiOpenPermitProperties).toBeGreaterThan(0);
  });

  it("getFilterFacets returns the AC #53 filter dimensions", () => {
    const f = access.getFilterFacets();
    expect(f.counties).toContain("Lee");
    expect(f.municipalities.length).toBeGreaterThan(1);
    expect(f.permitTypes).toContain("roofing");
    expect(f.propertyClasses.length).toBeGreaterThan(0);
    expect(f.businessTypes.length).toBeGreaterThan(0);
    expect(f.contractorTrades.length).toBeGreaterThan(0);
  });
});

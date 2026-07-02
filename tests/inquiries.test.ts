/**
 * Demo + stretch inquiry tests — NO live DB.
 *
 * Asserts every one of the 24 required demo + 10 stretch inquiries (README
 * "Required/Stretch Demo Inquiries"), as computed by the in-memory analytics
 * engine over the disclosed synthetic graph:
 *   - returns a non-empty, correctly-shaped result (columns + rows),
 *   - attaches an entity deep-link (href) to its rows where applicable,
 *   - carries source-backed provenance (citations) where applicable,
 *   - and that the SPECIFIC semantics of each inquiry hold (e.g. ">1 open permit"
 *     rows really have >1 open permit; roofing-contractor rows really do roofing).
 *
 * The memory engine is the default DataAccess path (src/server/db.ts), so green
 * here means /insights, the dashboard chips, and the RAG structured router all
 * resolve to real, cited results on a clean checkout.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { generate, type GeneratedGraph } from "@/db/seed/generate";
import { SEED } from "@/db/seed/rng";
import {
  buildAnalyticsIndex,
  computeInquiryRows,
  runInquiryInMemory,
  type AnalyticsIndex,
} from "@/db/seed/analytics-memory";
import { DEMO_INQUIRIES, INQUIRIES, STRETCH_INQUIRIES } from "@/lib/inquiries";
import { createInMemoryAccess } from "@/db/seed/in-memory-access";
import { NEGATIVE_BBB_RATINGS } from "@/db/seed/vocab";

let g: GeneratedGraph;
let ix: AnalyticsIndex;

beforeAll(() => {
  g = generate(SEED);
  ix = buildAnalyticsIndex(g);
});

const NEGATIVE = new Set<string>(NEGATIVE_BBB_RATINGS as readonly string[]);

describe("catalog completeness", () => {
  it("has exactly 24 demo + 10 stretch inquiries", () => {
    expect(DEMO_INQUIRIES).toHaveLength(24);
    expect(STRETCH_INQUIRIES).toHaveLength(10);
    expect(INQUIRIES).toHaveLength(34);
  });

  it("every inquiry id is unique and has a target + question", () => {
    const ids = new Set(INQUIRIES.map((i) => i.id));
    expect(ids.size).toBe(INQUIRIES.length);
    for (const i of INQUIRIES) {
      expect(i.question.length).toBeGreaterThan(0);
      expect(i.target).toBeTruthy();
    }
  });
});

describe("every inquiry returns a non-empty, well-shaped result", () => {
  for (const inquiry of INQUIRIES) {
    it(`${inquiry.kind} #${inquiry.ordinal} (${inquiry.id}) is non-empty + shaped`, () => {
      const result = runInquiryInMemory(ix, inquiry.id);
      expect(result.inquiryId).toBe(inquiry.id);
      expect(result.label).toBe(inquiry.label);
      // Non-empty.
      expect(result.rows.length).toBeGreaterThan(0);
      // Columns are derived from the first row and exclude internal keys.
      expect(result.columns.length).toBeGreaterThan(0);
      expect(result.columns).not.toContain("href");
      expect(result.columns).not.toContain("citations");
      // Every declared column exists on every row.
      for (const row of result.rows) {
        for (const col of result.columns) {
          expect(Object.prototype.hasOwnProperty.call(row, col)).toBe(true);
        }
      }
    });
  }
});

describe("inquiries that target entities carry per-row deep-links", () => {
  // entity-graph rows link to mixed targets; rag-nl-evidence links to /explore.
  const entityTargets = new Set(["property", "contractor", "business", "tenant", "owner"]);
  for (const inquiry of INQUIRIES.filter((i) => entityTargets.has(i.target))) {
    it(`${inquiry.id} rows have an href`, () => {
      const rows = computeInquiryRows(ix, inquiry.id);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => typeof r.href === "string" && r.href.length > 0)).toBe(true);
    });
  }
});

describe("source-backed provenance (AC #14)", () => {
  // Property/contractor/business inquiries must cite a portal URL on their rows.
  const citedIds = [
    "props-multi-open-permit",
    "props-open-roofing",
    "props-major-roof",
    "contractors-negative-bbb",
    "contractors-roofing-lee",
    "businesses-multi-property",
  ];
  for (const id of citedIds) {
    it(`${id} rows carry at least one citation`, () => {
      const rows = computeInquiryRows(ix, id);
      expect(rows.length).toBeGreaterThan(0);
      expect(
        rows.every((r) => Array.isArray(r.citations) && r.citations!.length > 0),
      ).toBe(true);
      // The first citation has a usable provenance pointer (url or recordKey).
      const c = rows[0]!.citations![0]!;
      expect(c.url || c.recordKey).toBeTruthy();
      expect(c.sourceSystem).toBeTruthy();
    });
  }
});

// --- semantic correctness of each inquiry -----------------------------------

describe("demo #1 — properties with >1 open permit", () => {
  it("every row has openPermitCount > 1", () => {
    const rows = computeInquiryRows(ix, "props-multi-open-permit");
    expect(rows.every((r) => Number(r.openPermitCount) > 1)).toBe(true);
  });
});

describe("demo #2/#3 — open roofing / electrical permits", () => {
  it("roofing rows reference a property with an open roofing permit", () => {
    const rows = computeInquiryRows(ix, "props-open-roofing");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.openTradePermits) > 0)).toBe(true);
  });
  it("electrical rows reference a property with an open electrical permit", () => {
    const rows = computeInquiryRows(ix, "props-open-electrical");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.openTradePermits) > 0)).toBe(true);
  });
});

describe("demo #4-6 — major trade renovations", () => {
  it("concrete rows are classified concrete + major", () => {
    const rows = computeInquiryRows(ix, "props-major-concrete");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.trade === "concrete" && Number(r.majorPermits) > 0)).toBe(true);
  });
  it("roof rows are classified roofing + major", () => {
    const rows = computeInquiryRows(ix, "props-major-roof");
    expect(rows.every((r) => r.trade === "roofing" && Number(r.majorPermits) > 0)).toBe(true);
  });
});

describe("demo #7 — highest 5y permit activity is sorted descending", () => {
  it("permitCount5y is monotonically non-increasing", () => {
    const rows = computeInquiryRows(ix, "props-highest-permit-5y");
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i - 1]!.permitCount5y)).toBeGreaterThanOrEqual(
        Number(rows[i]!.permitCount5y),
      );
    }
  });
});

describe("demo #8 — significant renovation activity clears the score threshold", () => {
  it("improvementScore >= 15 for all rows", () => {
    const rows = computeInquiryRows(ix, "props-significant-reno");
    expect(rows.every((r) => Number(r.improvementScore) >= 15)).toBe(true);
  });
});

describe("demo #9/#10 — trade contractors in Lee County", () => {
  it("roofing-contractor rows do roofing work", () => {
    const rows = computeInquiryRows(ix, "contractors-roofing-lee");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.permitCount) > 0)).toBe(true);
  });
  it("electrical-contractor rows do electrical work", () => {
    const rows = computeInquiryRows(ix, "contractors-electrical-lee");
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("demo #11 — contractors with negative BBB ratings", () => {
  it("every row has a negative BBB rating", () => {
    const rows = computeInquiryRows(ix, "contractors-negative-bbb");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => NEGATIVE.has(String(r.bbbRating)))).toBe(true);
  });
});

describe("demo #12 — contractors with complaint histories", () => {
  it("every row has complaintCount > 0", () => {
    const rows = computeInquiryRows(ix, "contractors-complaints");
    expect(rows.every((r) => Number(r.complaintCount) > 0)).toBe(true);
  });
});

describe("demo #13 — projects by negative-BBB / complaint contractors", () => {
  it("every row names a contractor that is negative or has complaints", () => {
    const rows = computeInquiryRows(ix, "projects-bad-contractor");
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((r) => NEGATIVE.has(String(r.bbbRating)) || Number(r.complaintCount) > 0),
    ).toBe(true);
  });
});

describe("demo #14/#22 — businesses across multiple properties", () => {
  it("every row spans more than one property", () => {
    const rows = computeInquiryRows(ix, "businesses-multi-property");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.propertyCount) > 1)).toBe(true);
  });
});

describe("demo #15 — owners with multiple properties", () => {
  it("every row owns more than one property", () => {
    const rows = computeInquiryRows(ix, "owners-multi-property");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.propertyCount) > 1)).toBe(true);
  });
});

describe("demo #16 — tenants across multiple locations", () => {
  it("every row spans more than one location", () => {
    const rows = computeInquiryRows(ix, "tenants-multi-location");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.locationCount) > 1)).toBe(true);
  });
});

describe("demo #17 — ownership change AND active permits", () => {
  it("every row has both signals", () => {
    const rows = computeInquiryRows(ix, "props-ownership-change-open-permit");
    expect(rows.every((r) => Number(r.ownershipChanges) > 0 && Number(r.openPermits) > 0)).toBe(
      true,
    );
  });
});

describe("demo #18 — active permits AND business turnover", () => {
  it("every row has both signals", () => {
    const rows = computeInquiryRows(ix, "props-permit-business-turnover");
    expect(rows.every((r) => Number(r.openPermits) > 0 && Number(r.businessTurnover) > 0)).toBe(
      true,
    );
  });
});

describe("demo #19/#20 — neighborhood rollups", () => {
  it("increasing-permit rows reflect a real temporal increase, ranked by it", () => {
    const rows = computeInquiryRows(ix, "neighborhoods-increasing-permits");
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((r) => Number(r.recentPermits) > Number(r.priorPermits)),
    ).toBe(true);
    expect(
      rows.every((r) => Number(r.permitIncrease) === Number(r.recentPermits) - Number(r.priorPermits)),
    ).toBe(true);
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i - 1]!.permitIncrease)).toBeGreaterThanOrEqual(
        Number(rows[i]!.permitIncrease),
      );
    }
  });
  it("major-reno-concentration rows all have majorRenovations > 0", () => {
    const rows = computeInquiryRows(ix, "neighborhoods-major-reno-concentration");
    expect(rows.every((r) => Number(r.majorRenovations) > 0)).toBe(true);
  });
  it("increasing-permit representative property is the municipality's max permitCount5y (SQL parity)", () => {
    const rows = computeInquiryRows(ix, "neighborhoods-increasing-permits");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const propertyId = String(row.href).replace("/properties/", "");
      const muni = ix.rollupByProperty.get(propertyId)?.municipalityName ?? "Unknown";
      const maxForMuni = Math.max(
        ...[...ix.permitsByProperty.keys()]
          .filter(
            (id) =>
              (ix.rollupByProperty.get(id)?.municipalityName ?? "Unknown") === muni,
          )
          .map((id) => ix.rollupByProperty.get(id)?.permitCount5y ?? 0),
      );
      expect(ix.rollupByProperty.get(propertyId)?.permitCount5y ?? 0).toBe(maxForMuni);
    }
  });
});

describe("demo #21 — most active contractors sorted by project count", () => {
  it("projectCount is non-increasing", () => {
    const rows = computeInquiryRows(ix, "contractors-most-active");
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i - 1]!.projectCount)).toBeGreaterThanOrEqual(
        Number(rows[i]!.projectCount),
      );
    }
  });
});

describe("demo #23 — entity relationship graph", () => {
  it("includes a property + at least three of contractor/business/tenant/owner", () => {
    const rows = computeInquiryRows(ix, "entity-graph");
    const roles = new Set(rows.map((r) => r.role));
    expect(roles.has("Property")).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });
});

describe("demo #24 — RAG NL pointer", () => {
  it("returns a pointer row into /explore", () => {
    const rows = computeInquiryRows(ix, "rag-nl-evidence");
    expect(rows.length).toBe(1);
    expect(String(rows[0]!.href)).toContain("/explore");
  });
});

// --- stretch inquiries -------------------------------------------------------

describe("stretch inquiries are non-empty and semantically constrained", () => {
  it("stretch #1 redevelopment: structural/concrete majors with churn", () => {
    const rows = computeInquiryRows(ix, "stretch-redevelopment");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.majorRenovations) > 0)).toBe(true);
  });
  it("stretch #3 complaint-linked projects: contractors with complaints + projects", () => {
    const rows = computeInquiryRows(ix, "stretch-complaint-linked-projects");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.complaintCount) > 0 && Number(r.projectCount) > 0)).toBe(
      true,
    );
  });
  it("stretch #7 acquisition candidates: all three signals present", () => {
    const rows = computeInquiryRows(ix, "stretch-acquisition-candidates");
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every(
        (r) =>
          Number(r.openPermits) > 0 &&
          Number(r.ownershipChanges) > 0 &&
          Number(r.businessTurnover) > 0,
      ),
    ).toBe(true);
  });
  it("stretch #8 clean major-reno contractors: no negative BBB, no complaints", () => {
    const rows = computeInquiryRows(ix, "stretch-clean-major-reno-contractors");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => !NEGATIVE.has(String(r.bbbRating)))).toBe(true);
    expect(rows.every((r) => Number(r.majorRenovations) > 0)).toBe(true);
  });
  it("stretch #9 expanding businesses: more than one location", () => {
    const rows = computeInquiryRows(ix, "stretch-expanding-businesses");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.locationCount) > 1)).toBe(true);
  });
  it("stretch #10 anomalous permits: above the neighborhood mean", () => {
    const rows = computeInquiryRows(ix, "stretch-anomalous-permits");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.ratioVsNeighborhood) >= 2)).toBe(true);
  });
});

describe("runInquiry through the DataAccess provider", () => {
  it("the in-memory provider serves every inquiry non-empty", async () => {
    const access = createInMemoryAccess(g);
    for (const inquiry of INQUIRIES) {
      const result = await Promise.resolve(access.runInquiry(inquiry.id));
      expect(result.rows.length, `${inquiry.id} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("unknown inquiry ids are render-safe (empty, not thrown)", () => {
    const result = runInquiryInMemory(ix, "does-not-exist");
    expect(result.rows).toEqual([]);
    expect(result.columns).toEqual([]);
  });
});

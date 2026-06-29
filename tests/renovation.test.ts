import { describe, expect, it } from "vitest";

import {
  classifyTrades,
  computeImprovementIndicators,
  improvementBand,
  improvementScore,
  isMajorRenovation,
  permitMatchesTrade,
} from "@/lib/renovation";

describe("classifyTrades", () => {
  it("classifies roofing", () => {
    expect(classifyTrades({ projectDescription: "Re-roof shingle replacement" })).toContain(
      "roofing",
    );
  });
  it("classifies electrical via volts even without keywords", () => {
    expect(classifyTrades({ improvementType: "service", volts: "240" })).toContain("electrical");
  });
  it("classifies multiple trades", () => {
    const t = classifyTrades({ projectDescription: "concrete slab and structural framing" });
    expect(t).toContain("concrete");
    expect(t).toContain("structural");
  });
});

describe("isMajorRenovation", () => {
  it("flags high value as major", () => {
    expect(isMajorRenovation({ estimatedJobValue: 75000 })).toBe(true);
  });
  it("flags structural scope as major", () => {
    expect(isMajorRenovation({ projectDescription: "structural addition" })).toBe(true);
  });
  it("does not flag small jobs", () => {
    expect(isMajorRenovation({ estimatedJobValue: 1200, projectDescription: "fence" })).toBe(
      false,
    );
  });
});

describe("improvementScore", () => {
  it("weights majors heavily", () => {
    const a = improvementScore({ permitCount5y: 1, majorRenovationCount: 2, totalPermitValue: 0 });
    const b = improvementScore({ permitCount5y: 1, majorRenovationCount: 0, totalPermitValue: 0 });
    expect(a).toBeGreaterThan(b);
  });
});

describe("classifyTrades — structured category key", () => {
  it("classifies via the canonical improvementType key", () => {
    expect(classifyTrades({ improvementType: "concrete" })).toContain("concrete");
    expect(classifyTrades({ improvementType: "hvac" })).toContain("hvac");
    // tenant_buildout maps to structural.
    expect(classifyTrades({ improvementType: "tenant_buildout" })).toContain("structural");
  });
});

describe("permitMatchesTrade", () => {
  it("matches a roofing permit to the roofing trade", () => {
    expect(permitMatchesTrade({ improvementType: "roofing" }, "roofing")).toBe(true);
    expect(permitMatchesTrade({ improvementType: "roofing" }, "plumbing")).toBe(false);
  });
});

describe("improvementBand", () => {
  it("bands by score", () => {
    expect(improvementBand(50)).toBe("high");
    expect(improvementBand(20)).toBe("medium");
    expect(improvementBand(5)).toBe("low");
  });
});

describe("computeImprovementIndicators", () => {
  it("rolls up permits into a significance verdict", () => {
    const ind = computeImprovementIndicators(
      [
        { improvementType: "roofing", estimatedJobValue: 80000 },
        { improvementType: "structural", estimatedJobValue: 120000 },
        { improvementType: "electrical", volts: "240", estimatedJobValue: 5000 },
      ],
      [true, false, false],
    );
    expect(ind.permitCount).toBe(3);
    expect(ind.openPermitCount).toBe(1);
    expect(ind.majorRenovationCount).toBe(2);
    expect(ind.trades).toEqual(expect.arrayContaining(["roofing", "structural", "electrical"]));
    expect(ind.isSignificant).toBe(true);
  });
});

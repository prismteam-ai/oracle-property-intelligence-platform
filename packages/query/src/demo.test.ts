import { describe, expect, it } from "vitest";

import { demoAnswerQuestion, demoListProperties, demoRunInquiry } from "./demo.js";
import { INQUIRIES } from "./inquiries/index.js";

const DEMO_FILTERS = {
  page: 1,
  pageSize: 25,
};

describe("demo corpus coverage", () => {
  it("scales the packaged corpus beyond the small fixture footprint", async () => {
    const properties = await demoListProperties({
      page: 1,
      pageSize: 1000,
    });

    expect(properties.total).toBeGreaterThanOrEqual(250);
  });

  it("returns at least one row for every registered inquiry", async () => {
    for (const inquiry of INQUIRIES) {
      const result = await demoRunInquiry(inquiry.key, DEMO_FILTERS);
      expect(result.total, inquiry.key).toBeGreaterThan(0);
      expect(result.rows.length, inquiry.key).toBeGreaterThan(0);
    }
  });

  it("grounds representative demo questions with citations", async () => {
    for (const question of [
      "Which contractors have poor BBB ratings?",
      "Which businesses operate across multiple properties?",
      "Which properties have open roofing permits?",
      "Which neighborhoods are showing the strongest redevelopment signals?",
    ]) {
      const answer = await demoAnswerQuestion(question);
      expect(answer.mode).toBe("demo answer");
      expect(answer.citations.length, question).toBeGreaterThan(0);
      expect(answer.evidence.length, question).toBeGreaterThan(0);
    }
  });

  it("renders demo answers as user-facing summaries instead of internal routing text", async () => {
    const answer = await demoAnswerQuestion("Which contractors have poor BBB ratings?");

    expect(answer.mode).toBe("demo answer");
    expect(answer.answer).toContain("contractors with weak BBB signals");
    expect(answer.answer).toContain("Top matches include");
    expect(answer.answer).not.toContain("closest grounded inquiry");
    expect(answer.answer).not.toContain("contractors-negative-bbb");
  });

  it("gives the demo inquiries enough depth for a recorded walkthrough", async () => {
    const thresholds: ReadonlyArray<readonly [string, number]> = [
      ["properties-multiple-open-permits", 25],
      ["properties-open-roofing-permit", 15],
      ["properties-open-electrical-permit", 15],
      ["contractors-negative-bbb", 4],
      ["projects-negative-contractors", 20],
      ["businesses-multiple-properties", 10],
      ["owners-multiple-properties", 10],
      ["tenants-multiple-locations", 8],
      ["neighborhoods-increasing-permits", 8],
      ["neighborhoods-major-renovation-concentration", 8],
    ];

    for (const [key, minimum] of thresholds) {
      const result = await demoRunInquiry(key, DEMO_FILTERS);
      expect(result.total, key).toBeGreaterThanOrEqual(minimum);
    }
  });
});

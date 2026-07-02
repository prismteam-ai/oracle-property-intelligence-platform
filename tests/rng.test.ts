import { describe, expect, it } from "vitest";

import { Rng, deterministicUuid } from "@/db/seed/rng";
import { routeInquiry } from "@/lib/inquiries";

describe("Rng", () => {
  it("is deterministic for a fixed seed", () => {
    const a = new Rng(20260615);
    const b = new Rng(20260615);
    const seqA = Array.from({ length: 5 }, () => a.int(0, 1000));
    const seqB = Array.from({ length: 5 }, () => b.int(0, 1000));
    expect(seqA).toEqual(seqB);
  });
  it("produces stable uuids for a fixed seed", () => {
    expect(deterministicUuid(new Rng(1))).toEqual(deterministicUuid(new Rng(1)));
  });
  it("formats uuid v4 shape", () => {
    const id = deterministicUuid(new Rng(42));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("routeInquiry", () => {
  it("routes an open-roofing question to the roofing inquiry", () => {
    const r = routeInquiry("Show all properties with open roofing permits");
    expect(r?.inquiry.id).toBe("props-open-roofing");
  });
});

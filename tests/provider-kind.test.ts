import { describe, expect, it } from "vitest";

import { resolveProviderKind } from "@/server/provider-kind";

describe("resolveProviderKind", () => {
  it("selects the in-memory provider for the documented clean-checkout dev default", () => {
    expect(resolveProviderKind({ NODE_ENV: "development" })).toBe("memory");
  });

  it("honors an explicit DATA_SOURCE=memory for a running build/server", () => {
    expect(resolveProviderKind({ NODE_ENV: "production", DATA_SOURCE: "memory" })).toBe(
      "memory",
    );
  });

  it("uses the in-memory provider under test", () => {
    expect(resolveProviderKind({ NODE_ENV: "test" })).toBe("memory");
  });

  it("selects local/neon when DATABASE_URL is present", () => {
    const url = "postgres://oracle:oracle@localhost:5432/oracle";
    expect(resolveProviderKind({ DATA_SOURCE: "local", DATABASE_URL: url })).toBe("local");
    expect(resolveProviderKind({ DATA_SOURCE: "neon", DATABASE_URL: url })).toBe("neon");
  });

  it("throws fail-loud for local/neon without DATABASE_URL (no silent fallback)", () => {
    expect(() => resolveProviderKind({ DATA_SOURCE: "local" })).toThrow(/DATABASE_URL/);
    expect(() => resolveProviderKind({ DATA_SOURCE: "neon" })).toThrow(/DATABASE_URL/);
  });

  it("throws in production when DATA_SOURCE is unset (no silent in-memory prod fallback)", () => {
    expect(() => resolveProviderKind({ NODE_ENV: "production" })).toThrow(/production/);
  });
});

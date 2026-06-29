/**
 * Dataset-mode + row-display-cap tests — NO live DB.
 *
 * Covers the configurable row cap (raised from the old hard 50) and the
 * synthetic/real disclosure mode that drives the site-wide DataBanner.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_ROW_LIMIT,
  MAX_ROW_LIMIT,
  datasetMode,
  isSynthetic,
  rowDisplayLimit,
} from "@/lib/dataset";

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("row display cap", () => {
  it("defaults to 200 (raised from the old hard 50)", () => {
    delete process.env.ROW_DISPLAY_LIMIT;
    expect(rowDisplayLimit()).toBe(DEFAULT_ROW_LIMIT);
    expect(DEFAULT_ROW_LIMIT).toBe(200);
    expect(DEFAULT_ROW_LIMIT).toBeGreaterThan(50);
  });

  it("honors ROW_DISPLAY_LIMIT when set", () => {
    process.env.ROW_DISPLAY_LIMIT = "120";
    expect(rowDisplayLimit()).toBe(120);
  });

  it("clamps to a sane upper bound so payloads stay small", () => {
    process.env.ROW_DISPLAY_LIMIT = "100000";
    expect(rowDisplayLimit()).toBe(MAX_ROW_LIMIT);
  });

  it("falls back to the default for junk / non-positive values", () => {
    process.env.ROW_DISPLAY_LIMIT = "-5";
    expect(rowDisplayLimit()).toBe(DEFAULT_ROW_LIMIT);
    process.env.ROW_DISPLAY_LIMIT = "abc";
    expect(rowDisplayLimit()).toBe(DEFAULT_ROW_LIMIT);
  });
});

describe("dataset disclosure mode", () => {
  it("defaults to the disclosed synthetic dataset", () => {
    delete process.env.DATA_SOURCE;
    expect(datasetMode()).toBe("memory");
    expect(isSynthetic()).toBe(true);
  });

  it("treats local as synthetic and neon as real", () => {
    process.env.DATA_SOURCE = "local";
    expect(datasetMode()).toBe("local");
    expect(isSynthetic()).toBe(true);
    process.env.DATA_SOURCE = "neon";
    expect(datasetMode()).toBe("neon");
    expect(isSynthetic()).toBe(false);
  });
});

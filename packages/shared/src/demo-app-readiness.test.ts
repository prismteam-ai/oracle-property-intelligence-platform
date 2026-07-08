import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

describe("demo app readiness", () => {
  test("vercel deploys the real web app instead of the static fixture runtime", () => {
    const vercelConfig = readFileSync("vercel.json", "utf8");

    expect(vercelConfig).toContain("@oracle/web");
    expect(vercelConfig).not.toContain("Property Hub.dc.html");
    expect(vercelConfig).not.toContain("oracle-data.js");
  });

  test("primary navigation uses the real demo view names", () => {
    const navSource = readFileSync("packages/shared/src/workbench-copy.ts", "utf8");

    expect(navSource).toContain('label: "Workspace"');
    expect(navSource).toContain('label: "Properties"');
    expect(navSource).toContain('label: "Tenancy"');
    expect(navSource).toContain('label: "Businesses"');
    expect(navSource).toContain('label: "Contractors"');
    expect(navSource).toContain('label: "Inquiries"');
    expect(navSource).not.toContain('label: "Insights"');
    expect(navSource).not.toContain('label: "Parcels"');
  });

  test("next build does not force standalone output for the Vercel-hosted app", () => {
    const nextConfig = readFileSync("apps/web/next.config.ts", "utf8");

    expect(nextConfig).not.toContain('output: "standalone"');
  });
});

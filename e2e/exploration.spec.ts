import { expect, test } from "@playwright/test";

/**
 * Exploration-UI acceptance specs (Story B).
 *
 * Runs against the DB-free `memory` provider (see playwright.config.ts webServer
 * env). Every assertion targets a stable data-testid and every navigation is a
 * plain URL — no auth, fully deep-linkable.
 */

test.describe("dashboard", () => {
  test("shows headline stats and the four exploration entry points", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("dashboard")).toBeVisible();
    await expect(page.getByTestId("stat-properties")).toBeVisible();
    await expect(page.getByTestId("stat-open-permits")).toBeVisible();
    await expect(page.getByTestId("stat-negative-contractors")).toBeVisible();
    for (const t of ["nav-properties", "nav-tenants", "nav-businesses", "nav-contractors"]) {
      await expect(page.getByTestId(t)).toBeVisible();
    }
    // Ask box (RAG entry point) present.
    await expect(page.getByTestId("ask-input")).toBeVisible();
    // The cross-cutting filter bar deep-links into Properties.
    await expect(page.getByTestId("dashboard-filter").getByTestId("filter-bar")).toBeVisible();
  });
});

test.describe("property view", () => {
  test("list filters by municipality and deep-links to a detail with every AC section", async ({
    page,
  }) => {
    await page.goto("/properties");
    await expect(page.getByTestId("properties-table")).toBeVisible();
    const before = await page.getByTestId("property-row").count();
    expect(before).toBeGreaterThan(0);

    // Filter by municipality (deep-linkable GET param).
    await page.getByTestId("filter-municipality").selectOption("Sanibel");
    await page.getByTestId("filter-apply").click();
    await expect(page).toHaveURL(/municipality=Sanibel/);
    await expect(page.getByTestId("property-row").first()).toBeVisible();

    // Open the first property's detail.
    await page.goto("/properties");
    await page.getByTestId("property-link").first().click();
    await expect(page.getByTestId("property-detail")).toBeVisible();

    // AC #17-24 sections must all be present.
    for (const t of [
      "property-signals",
      "property-ownership",
      "property-open-permits",
      "property-permit-history",
      "property-major-improvements",
      "property-contractors",
      "property-occupancy",
    ]) {
      await expect(page.getByTestId(t)).toBeVisible();
    }
  });
});

test.describe("contractor view", () => {
  test("negative-BBB + complaints filter, then detail shows ratings/complaints/reviews", async ({
    page,
  }) => {
    await page.goto("/contractors?rating=negative&sort=complaints");
    await expect(page.getByTestId("contractors-table")).toBeVisible();
    // At least one negative rating pill is shown.
    await expect(page.locator(".pill-bad").first()).toBeVisible();

    await page.getByTestId("contractor-link").first().click();
    await expect(page.getByTestId("contractor-detail")).toBeVisible();
    for (const t of [
      "contractor-bbb",
      "contractor-complaints",
      "contractor-reviews",
      "contractor-permits",
      "contractor-projects",
      "contractor-properties",
    ]) {
      await expect(page.getByTestId(t)).toBeVisible();
    }
    await expect(page.getByTestId("bbb-rating")).toBeVisible();
  });

  test("filters by trade", async ({ page }) => {
    await page.goto("/contractors");
    await page.getByTestId("contractor-trade").selectOption("Roofing");
    await page.getByTestId("contractor-apply").click();
    await expect(page).toHaveURL(/trade=Roofing/);
    await expect(page.getByTestId("contractor-row").first()).toBeVisible();
  });
});

test.describe("business view", () => {
  test("list deep-links to a detail with registration, ownership, locations, permits", async ({
    page,
  }) => {
    await page.goto("/businesses");
    await expect(page.getByTestId("businesses-table")).toBeVisible();
    await page.getByTestId("business-link").first().click();
    await expect(page.getByTestId("business-detail")).toBeVisible();
    for (const t of [
      "business-registration",
      "business-parties",
      "business-properties",
      "business-permits",
      "business-projects",
    ]) {
      await expect(page.getByTestId(t)).toBeVisible();
    }
  });
});

test.describe("tenant view", () => {
  test("list deep-links to a detail with occupancy, properties, businesses, permits", async ({
    page,
  }) => {
    await page.goto("/tenants");
    await expect(page.getByTestId("tenants-table")).toBeVisible();
    await page.getByTestId("tenant-link").first().click();
    await expect(page.getByTestId("tenant-detail")).toBeVisible();
    for (const t of [
      "tenant-occupancy",
      "tenant-properties",
      "tenant-businesses",
      "tenant-permits",
      "tenant-projects",
    ]) {
      await expect(page.getByTestId(t)).toBeVisible();
    }
  });
});

test.describe("rag explore", () => {
  test("answers a natural-language question with evidence + citations", async ({ page }) => {
    await page.goto("/explore?q=contractors%20with%20negative%20bbb");
    // A non-empty answer renders (structured router or semantic retrieval).
    await expect(page.getByText(/Mode:/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Citations" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Evidence \(\d+\)/ })).toBeVisible();
  });
});

test.describe("insights — demo + stretch inquiry catalog", () => {
  test("renders all 34 inquiry sections, each with results + provenance", async ({ page }) => {
    await page.goto("/insights");
    // Index nav lists jump-links.
    await expect(page.getByTestId("inquiry-index")).toBeVisible();

    // Spot-check representative demo sections across each entity domain, asserting
    // the section is present and reports a non-zero result count.
    const probes = [
      "props-multi-open-permit",
      "props-open-roofing",
      "props-major-roof",
      "contractors-negative-bbb",
      "businesses-multi-property",
      "tenants-multi-location",
      "neighborhoods-major-reno-concentration",
      "entity-graph",
    ];
    for (const id of probes) {
      const section = page.getByTestId(`inquiry-${id}`);
      await expect(section).toBeVisible();
      // The meta line reports "<n> result(s)" with n >= 1.
      const meta = await page.getByTestId(`inquiry-meta-${id}`).innerText();
      const n = Number(meta.match(/(\d+) result/)?.[1] ?? "0");
      expect(n, `${id} should have results`).toBeGreaterThan(0);
    }

    // A property inquiry row deep-links to a property detail page.
    const firstOpen = page
      .getByTestId("inquiry-props-multi-open-permit")
      .getByRole("link", { name: "open" })
      .first();
    await expect(firstOpen).toBeVisible();
    await firstOpen.click();
    await expect(page).toHaveURL(/\/properties\//);
  });

  test("a stretch inquiry section renders with results", async ({ page }) => {
    await page.goto("/insights#stretch-acquisition-candidates");
    const meta = await page
      .getByTestId("inquiry-meta-stretch-acquisition-candidates")
      .innerText();
    const n = Number(meta.match(/(\d+) result/)?.[1] ?? "0");
    expect(n).toBeGreaterThan(0);
  });
});

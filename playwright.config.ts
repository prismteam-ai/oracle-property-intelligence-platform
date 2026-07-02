import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the exploration UI smoke + acceptance specs.
 *
 * The webServer runs the app with the DEFAULT `memory` DataAccess provider, so
 * the suite needs NO Postgres, docker, model download, or API key — exactly the
 * "no live DB needed" contract. Routes are deep-linkable and auth-free, so each
 * test navigates by URL and asserts on stable data-testid hooks.
 */
const PORT = Number(process.env.PW_PORT ?? 3210);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { DATA_SOURCE: "memory", NODE_ENV: "production" },
  },
});

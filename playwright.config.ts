import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a real server (Next + Socket.IO + Postgres).
 * Set E2E_BASE_URL to test an already-running server; otherwise one is started on :3100.
 * PW_CHROMIUM_PATH lets CI or sandboxes point at a preinstalled Chromium.
 */
const port = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `PORT=${port} npx tsx server.ts`, url: `${baseURL}/api/games`, timeout: 180_000, reuseExistingServer: true },
});

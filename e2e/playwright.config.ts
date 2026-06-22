import { defineConfig, devices } from "@playwright/test";

const shellPort = process.env.PLAYWRIGHT_SHELL_PORT ?? "5174";
const shellBase = `http://127.0.0.1:${shellPort}`;

export default defineConfig({
  testDir: "./post-deploy",
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 90_000 },
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    baseURL: shellBase,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

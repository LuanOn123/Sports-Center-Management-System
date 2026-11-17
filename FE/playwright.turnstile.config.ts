import { defineConfig } from "@playwright/test";
import browserConfig, { testServer } from "./playwright.config";

const baseURL = "http://127.0.0.1:5174";

export default defineConfig({
  ...browserConfig,
  testMatch: "turnstile.spec.ts",
  testIgnore: [],
  outputDir: "artifacts/turnstile-results",
  use: { ...browserConfig.use, baseURL },
  webServer: testServer(baseURL),
  reporter: "list",
});

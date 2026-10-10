import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "turnstile.spec.ts",
  outputDir: "test-results/turnstile",
  use: { baseURL: "http://127.0.0.1:5174", headless: true },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    env: { VITE_CLOUDFLARE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
  },
  reporter: "list",
});

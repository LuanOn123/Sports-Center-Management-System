import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testIgnore: "**/turnstile.spec.ts",
  use: { baseURL: "http://localhost:5173", headless: true },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
  reporter: "list",
});

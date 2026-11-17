import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:5175";

export function testServer(url: string) {
  return {
    command: `npm run dev -- --port ${new URL(url).port} --strictPort`,
    url,
    reuseExistingServer: false,
    env: {
      VITE_API_BASE_URL: `${url}/api/v1`,
      VITE_CLOUDFLARE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      VITE_GOOGLE_CLIENT_ID: "",
      VITE_SEPAY_MOCK_MODE: "false",
    },
  };
}

export default defineConfig({
  testDir: "./tests/browser",
  testIgnore: "**/turnstile.spec.ts",
  workers: 2,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    launchOptions: {
      executablePath: process.env.SCMS_CHROMIUM_EXECUTABLE,
      args: [
        // Keep unmocked asset requests local so they cannot stall the browser.
        "--no-proxy-server",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1",
      ],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: testServer(baseURL),
  reporter: [["list"], ["html", { open: "never" }]],
});

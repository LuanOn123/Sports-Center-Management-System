import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("blocks login when Turnstile has not been configured", async () => {
  vi.stubEnv("VITE_CLOUDFLARE_TURNSTILE_SITE_KEY", "");
  const config = await import("../src/shared/turnstileConfig");
  expect(() => config.requireLoginCaptcha()).toThrow("chưa được cấu hình");
  expect(() => config.requireLoginCaptcha("fake-token")).toThrow("chưa được cấu hình");
});

it("rejects missing tokens when a public site key is configured", async () => {
  vi.stubEnv("VITE_CLOUDFLARE_TURNSTILE_SITE_KEY", " public-key ");
  const config = await import("../src/shared/turnstileConfig");
  expect(config.turnstileSiteKey).toBe("public-key");
  expect(() => config.requireLoginCaptcha()).toThrow("Vui lòng hoàn tất");
  expect(() => config.requireLoginCaptcha("  ")).toThrow("Vui lòng hoàn tất");
  expect(() => config.requireLoginCaptcha("challenge-token")).not.toThrow();
});

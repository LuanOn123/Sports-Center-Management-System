import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { env } from "../../src/config/env.js";

/** Business E2Es run real HTTP login; only the external Cloudflare response is a fixture.
 * Login security (including failure, replay and outage cases) has its own test:captcha suite.
 * This file is never imported by application code and refuses non-local test databases.
 */
export function installTurnstileFixture() {
  const db = new URL(process.env.DATABASE_URL!);
  const mongo = new URL(process.env.MONGO_URI!);
  assert.match(db.searchParams.get("schema") ?? "", /^scms_verify_/);
  assert.ok(
    [db.hostname, mongo.hostname].every((host) =>
      ["127.0.0.1", "localhost", "[::1]"].includes(host),
    ),
    "Turnstile fixtures require disposable local PostgreSQL and MongoDB",
  );
  const originalFetch = globalThis.fetch;
  const originalSecret = env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  const secret = randomUUID();
  const used = new Set<string>();
  env.CLOUDFLARE_TURNSTILE_SECRET_KEY = secret;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url !== "https://challenges.cloudflare.com/turnstile/v0/siteverify")
      return originalFetch(input, init);
    const params = new URLSearchParams(String(init?.body ?? ""));
    const token = params.get("response") ?? "";
    const success =
      params.get("secret") === secret &&
      token.startsWith("e2e-turnstile-") &&
      !used.has(token);
    used.add(token);
    return Response.json({ success, action: "login" });
  };
  return () => {
    globalThis.fetch = originalFetch;
    env.CLOUDFLARE_TURNSTILE_SECRET_KEY = originalSecret;
  };
}

export function withFixtureTurnstile(body: unknown) {
  assert.ok(body && typeof body === "object");
  return { ...body, turnstileToken: `e2e-turnstile-${randomUUID()}` };
}

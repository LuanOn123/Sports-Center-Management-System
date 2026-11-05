import "dotenv/config";
import assert from "node:assert/strict";
import {
  installTurnstileFixture,
  withFixtureTurnstile,
} from "./turnstile-fixture.js";

// Business suites exercise real HTTP auth and business handlers. Only the external
// CAPTCHA response is isolated; production never imports either helper.
assert.equal(
  process.env.NODE_ENV,
  "test",
  "Business E2E requires NODE_ENV=test",
);
installTurnstileFixture(); // enforces disposable PG schema + local PG AND Mongo; single-use tokens
const fixtureFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const target = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (
    ["localhost", "127.0.0.1"].includes(target.hostname) &&
    target.pathname === "/api/v1/auth/login" &&
    init?.method === "POST" &&
    typeof init.body === "string"
  ) {
    return fixtureFetch(input, {
      ...init,
      body: JSON.stringify(withFixtureTurnstile(JSON.parse(init.body))),
    });
  }
  return fixtureFetch(input, init);
};

import "dotenv/config";
import { randomBytes } from "node:crypto";

// Only this test process intercepts Cloudflare; application code has no bypass.
const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
if (process.env.NODE_ENV !== "test" || !["127.0.0.1", "localhost"].includes(url.hostname)
  || !/^scms_verify_/.test(url.searchParams.get("schema") ?? ""))
  throw new Error("Business E2E requires NODE_ENV=test and a disposable local scms_verify_ schema. Use test:qa:isolation -- --legacy-e2e.");
process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = randomBytes(32).toString("hex");
const originalFetch = globalThis.fetch;
const token = randomBytes(32).toString("hex");
globalThis.fetch = async (input, init) => {
  const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (target.href === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
    const body = new URLSearchParams(String(init?.body ?? ""));
    return Response.json({ success: body.get("response") === token, action: "login" });
  }
  if (["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname.endsWith("/auth/login")
    && typeof init?.body === "string") {
    const body = JSON.parse(init.body);
    return originalFetch(input, { ...init, body: JSON.stringify({ ...body, turnstileToken: token }) });
  }
  return originalFetch(input, init);
};

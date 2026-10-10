import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import express from "express";

// Isolated process: never load local secrets or connect to application databases.
process.env.DOTENV_CONFIG_PATH = "tests/nonexistent-turnstile-test.env";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_ACCESS_SECRET = randomBytes(32).toString("hex");
process.env.JWT_REFRESH_SECRET = randomBytes(32).toString("hex");
process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = randomBytes(32).toString("hex");

test("login enforces Turnstile before credentials and JWT issuance", async (t) => {
  const { default: authRoutes } = await import("../src/modules/auth/auth.routes.js");
  const { errorHandler } = await import("../src/middlewares/errorHandler.js");
  const { env } = await import("../src/config/env.js");
  const { User } = await import("../src/models/User.js");
  const { RefreshToken } = await import("../src/models/RefreshToken.js");
  const { prisma } = await import("../src/config/prisma.js");
  const { hashPassword } = await import("../src/utils/bcrypt.js");
  const { verifyAccessToken, verifyRefreshToken } = await import("../src/utils/jwt.js");
  const { login } = await import("../src/modules/auth/auth.service.js");
  const hash = await hashPassword("correct-password");
  let role = "COACH", isActive = true;
  let events: string[] = [];
  const lookup = mock.method(User, "findOne", () => {
    events.push("credentials");
    return { select: async () => ({ _id: "507f1f77bcf86cd799439011", role,
      password: hash, isActive, facility: null }) };
  });
  const sessions = mock.method(RefreshToken, "create", async () => { events.push("session"); });
  const originalFindProfile = prisma.memberProfile.findUnique;
  Reflect.set(prisma.memberProfile, "findUnique", async () => null);
  const logs = mock.method(console, "error", () => {});
  const originalFetch = globalThis.fetch;
  let response: unknown = { success: true, action: "login" };
  let failure = "";
  const used = new Set<string>();
  const upstream = mock.method(globalThis, "fetch", async (url: Parameters<typeof fetch>[0], options?: Parameters<typeof fetch>[1]) => {
    if (String(url).startsWith("http://127.0.0.1:")) return originalFetch(url, options);
    assert.equal(String(url), "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(options?.method, "POST");
    const body = new URLSearchParams(String(options?.body));
    assert.equal(body.get("secret"), env.CLOUDFLARE_TURNSTILE_SECRET_KEY);
    assert.equal(body.has("remoteip"), false);
    const signal = options?.signal;
    assert.ok(signal);
    events.push("captcha");
    if (failure === "network") throw new Error("upstream-private-detail");
    if (failure === "timeout") return new Promise<Response>((_, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    if (failure === "http") return new Response("private-upstream-body", { status: 502 });
    if (failure === "json") return new Response("invalid JSON");
    if (failure === "replay") {
      const token = body.get("response")!;
      const success = !used.has(token); used.add(token);
      return Response.json({ success, action: "login", "error-codes": success ? [] : ["timeout-or-duplicate"] });
    }
    return Response.json(response);
  });
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes as any);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/auth/login`;
  const request = async (extra: Record<string, unknown> = {}) => {
    events = [];
    const result = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.invalid", password: "correct-password", ...extra }) });
    const body = await result.json();
    if (result.status !== 200) {
      assert.equal(body.data?.accessToken, undefined);
      assert.equal(body.data?.refreshToken, undefined);
      assert.equal(result.headers.has("set-cookie"), false);
      assert.equal(JSON.stringify(body).includes(env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "never-exposed"), false);
    }
    return { status: result.status, body };
  };
  try {
    for (const token of [undefined, "", "   ", null, true, "x".repeat(2049)]) {
      await t.test(`rejects missing/invalid DTO token (${typeof token}, ${String(token).length})`, async () => {
        assert.equal((await request({ turnstileToken: token })).status, 400);
        assert.deepEqual(events, []);
      });
    }
    for (const data of [{ success: false }, { success: false, "error-codes": ["timeout-or-duplicate"] },
      { success: "true" }, {}, null, { success: true, action: "register" }, { success: true }]) {
      await t.test(`rejects upstream result ${JSON.stringify(data)}`, async () => {
        response = data;
        assert.notEqual((await request({ turnstileToken: "fake-token" })).status, 200);
        assert.deepEqual(events, ["captcha"]);
      });
    }
    for (const mode of ["network", "http", "json", "timeout"]) {
      await t.test(`fails closed on ${mode}`, async () => {
        failure = mode;
        try {
          assert.equal((await request({ turnstileToken: "test-token" })).status, 503);
          assert.deepEqual(events, ["captcha"]);
        } finally { failure = ""; }
      });
    }
    await t.test("missing server secret never bypasses verification", async () => {
      const secret = env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
      env.CLOUDFLARE_TURNSTILE_SECRET_KEY = "";
      try {
        assert.equal((await request({ turnstileToken: "test-token" })).status, 503);
        assert.deepEqual(events, []);
      } finally { env.CLOUDFLARE_TURNSTILE_SECRET_KEY = secret; }
    });
    response = { success: true, action: "login" };
    for (const selected of ["ADMIN", "MANAGER", "RECEPTIONIST", "COACH", "MEMBER"]) {
      await t.test(`valid CAPTCHA and ${selected} credentials issue existing JWTs`, async () => {
        role = selected;
        const result = await request({ turnstileToken: "valid-test-token" });
        assert.equal(result.status, 200);
        assert.equal(verifyAccessToken(result.body.data.accessToken).role, selected);
        assert.equal(verifyRefreshToken(result.body.data.refreshToken).role, selected);
        assert.deepEqual(events, ["captcha", "credentials", "session"]);
      });
    }
    await t.test("wrong password consumes CAPTCHA; replay cannot reach credentials", async () => {
      failure = "replay";
      assert.equal((await request({ password: "wrong", turnstileToken: "single-use" })).status, 401);
      assert.deepEqual(events, ["captcha", "credentials"]);
      assert.equal((await request({ turnstileToken: "single-use" })).status, 400);
      assert.deepEqual(events, ["captcha"]);
      failure = "";
    });
    await t.test("inactive account remains blocked", async () => {
      isActive = false;
      assert.equal((await request({ turnstileToken: "valid-test-token" })).status, 403);
      assert.deepEqual(events, ["captcha", "credentials"]);
      isActive = true;
    });
    await t.test("direct service calls cannot omit CAPTCHA", async () => {
      events = [];
      await assert.rejects(login("test@example.invalid", "correct-password", ""));
      assert.deepEqual(events, []);
    });
    assert.ok(lookup.mock.callCount() > 0);
    assert.equal(sessions.mock.callCount(), 5);
    assert.ok(upstream.mock.callCount() > 0);
    assert.equal(JSON.stringify(logs.mock.calls).includes(env.CLOUDFLARE_TURNSTILE_SECRET_KEY), false);
    assert.equal(JSON.stringify(logs.mock.calls).includes("upstream-private-detail"), false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    prisma.memberProfile.findUnique = originalFindProfile;
    mock.restoreAll();
    await prisma.$disconnect();
  }
});


import { beforeEach, describe, expect, it, vi } from "vitest";
const envelope = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      success: status < 400,
      message: status < 400 ? "OK" : "Expired",
      data,
    }),
    { status },
  );
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});
describe("API client contract and authentication", () => {
  it("rejects an undocumented endpoint before network access", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("../src/shared/api");
    await expect(api("GET /invented")).rejects.toThrow(
      "Undocumented operation",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects undocumented pagination and encodes path parameters", async () => {
    const fetch = vi.fn().mockResolvedValue(envelope({}));
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("../src/shared/api");
    await expect(
      api("GET /membership-plans", { query: { page: "2" } }),
    ).rejects.toThrow("Undocumented query");
    await api("GET /users/{id}", { params: { id: "a/b?c" } });
    expect(fetch.mock.calls[0][0]).toMatch(/\/users\/a%2Fb%3Fc$/);
  });
  it("shares one refresh for concurrent 401 responses and retries with the new token", async () => {
    sessionStorage.setItem("pulse.access", "old");
    sessionStorage.setItem("pulse.refresh", "refresh");
    let refreshCalls = 0;
    const fetch = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith("/auth/refresh-token")) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 20));
        return envelope({ accessToken: "new" });
      }
      return (options.headers as Record<string, string>).Authorization ===
        "Bearer old"
        ? envelope(null, 401)
        : envelope([]);
    });
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("../src/shared/api");
    const result = await Promise.all([api("GET /users"), api("GET /rooms")]);
    expect(refreshCalls).toBe(1);
    expect(result.every((r) => r.success)).toBe(true);
    expect(sessionStorage.getItem("pulse.access")).toBe("new");
  });
  it("clears tokens and announces session expiration when refresh is rejected", async () => {
    sessionStorage.setItem("pulse.access", "old");
    sessionStorage.setItem("pulse.refresh", "bad");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => envelope(null, 401)),
    );
    const { api } = await import("../src/shared/api");
    await expect(api("GET /users")).rejects.toMatchObject({ status: 401 });
    expect(sessionStorage.getItem("pulse.access")).toBeNull();
    expect(window.dispatchEvent).toHaveBeenCalled();
  });
  it("retains field validation errors and does not refresh on forbidden", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: "Validation failed",
            errors: [{ field: "capacity", message: "Must be positive" }],
          }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(envelope(null, 403));
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("../src/shared/api");
    await expect(
      api("POST /rooms", { body: { name: "A", capacity: 0 } }),
    ).rejects.toMatchObject({
      status: 400,
      errors: [{ field: "capacity", message: "Giá trị phải lớn hơn 0." }],
    });
    await expect(api("GET /users")).rejects.toMatchObject({ status: 403 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("reports malformed server content instead of inventing an empty result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("<html>Unavailable</html>", { status: 502 }),
      ),
    );
    const { api } = await import("../src/shared/api");
    await expect(api("GET /sports")).rejects.toMatchObject({ status: 502 });
  });
});

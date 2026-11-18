import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function response(data: unknown, status = 200, message = "OK") {
  return Response.json({ success: status < 400, data, message }, { status });
}

const fetchMock =
  vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
const result = { id: "server-result" };
type Api = Awaited<ReturnType<typeof loadClients>>;

async function loadClients() {
  const { api } = await import("../src/shared/api");
  const { sepayApi } = await import("../src/api/sepay.api");
  const { enrollmentsApi } = await import("../src/api/enrollments.api");
  const { membershipApi } = await import("../src/api/membership.api");
  const { classesApi } = await import("../src/api/classes.api");
  return { api, sepayApi, enrollmentsApi, membershipApi, classesApi };
}

beforeEach(() => {
  vi.resetModules();
  const storage = new Map([
    ["pulse.identity-version", "mongo-identities-v1"],
    ["pulse.access", "fixture-member-token"],
    ["pulse.facility", "facility-a"],
  ]);
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => response(result));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type RequestCase = {
  title: string;
  method: string;
  path: string;
  body?: object;
  query?: Record<string, string>;
  call: (client: Api) => Promise<unknown>;
};

describe("member and staff actions forward the intended request", () => {
  const requests: RequestCase[] = [
    {
      title: "checkout sends just the plan for immediate purchase",
      method: "POST",
      path: "/payments/sepay/checkout",
      body: { planId: "standard" },
      call: ({ sepayApi }) => sepayApi.createCheckout("standard"),
    },
    {
      title: "checkout preserves the scheduled start and Vietnam offset",
      method: "POST",
      path: "/payments/sepay/checkout",
      body: { planId: "premium", startDate: "2027-03-01T00:00:00+07:00" },
      call: ({ sepayApi }) =>
        sepayApi.createCheckout("premium", "2027-03-01T00:00:00+07:00"),
    },
    {
      title:
        "checkout status treats its identifier as one encoded path segment",
      method: "GET",
      path: "/payments/sepay/order%2F2027%3Fversion%3D2",
      call: ({ sepayApi }) => sepayApi.getCheckout("order/2027?version=2"),
    },
    {
      title: "refund queue sends the server-side pending filter",
      method: "GET",
      path: "/payments",
      query: { refundPending: "true", limit: "50" },
      call: ({ api }) =>
        api("GET /payments", { query: { refundPending: "true", limit: "50" } }),
    },
    {
      title: "payment lookup preserves the member and terminal status filters",
      method: "GET",
      path: "/payments",
      query: { memberId: "member-b", status: "REFUNDED" },
      call: ({ api }) =>
        api("GET /payments", {
          query: { memberId: "member-b", status: "REFUNDED" },
        }),
    },
    {
      title:
        "refund approval uses the chosen payment and carries only the reason",
      method: "POST",
      path: "/payments/payment-a/refund/request",
      body: { reason: "Đơn không thể cấp gói" },
      call: ({ api }) =>
        api("POST /payments/{id}/refund/request", {
          params: { id: "payment-a" },
          body: { reason: "Đơn không thể cấp gói" },
        }),
    },
    {
      title:
        "refund confirmation sends proof instead of a client-selected refund amount",
      method: "POST",
      path: "/payments/payment-a/refund/confirm",
      body: { reason: "Đã chuyển hoàn", reference: "RETURN-123" },
      call: ({ api }) =>
        api("POST /payments/{id}/refund/confirm", {
          params: { id: "payment-a" },
          body: { reason: "Đã chuyển hoàn", reference: "RETURN-123" },
        }),
    },
    {
      title:
        "staff sends the selected member and payment method when selling a package",
      method: "POST",
      path: "/counter-orders",
      body: {
        planId: "premium",
        memberId: "member-b",
        method: "BANK_TRANSFER",
      },
      call: ({ api }) =>
        api("POST /counter-orders", {
          body: {
            planId: "premium",
            memberId: "member-b",
            method: "BANK_TRANSFER",
          },
        }),
    },
    {
      title: "counter collection confirmation uses the order endpoint",
      method: "POST",
      path: "/counter-orders/order-a/confirm",
      body: { reason: "Đã thu tiền" },
      call: ({ api }) =>
        api("POST /counter-orders/{id}/confirm", {
          params: { id: "order-a" },
          body: { reason: "Đã thu tiền" },
        }),
    },
    {
      title: "member cancellation uses the membership cancellation endpoint",
      method: "PATCH",
      path: "/subscriptions/sub-a/cancel",
      body: { reason: "Ngừng tập" },
      call: ({ api }) =>
        api("PATCH /subscriptions/{id}/cancel", {
          params: { id: "sub-a" },
          body: { reason: "Ngừng tập" },
        }),
    },
    {
      title:
        "staff cancellation sends a status update to the selected subscription",
      method: "PATCH",
      path: "/subscriptions/sub-b/status",
      body: { status: "CANCELLED" },
      call: ({ api }) =>
        api("PATCH /subscriptions/{id}/status", {
          params: { id: "sub-b" },
          body: { status: "CANCELLED" },
        }),
    },
    {
      title: "class discovery retains term, tier and inactive filters",
      method: "GET",
      path: "/classes",
      query: {
        search: "Bơi & yoga",
        termId: "term-a",
        classType: "PREMIUM",
        isActive: "false",
      },
      call: ({ classesApi }) =>
        classesApi.getClasses({
          search: "Bơi & yoga",
          termId: "term-a",
          classType: "PREMIUM",
          isActive: false,
        }),
    },
    {
      title: "course eligibility loads the selected course plan",
      method: "GET",
      path: "/classes/class-a/course-plan",
      call: ({ classesApi }) => classesApi.getCoursePlan("class-a"),
    },
    {
      title:
        "self-booking sends the selected session without a member override",
      method: "POST",
      path: "/enrollments",
      body: { scheduleId: "session-a" },
      call: ({ enrollmentsApi }) => enrollmentsApi.bookClass("session-a"),
    },
    {
      title:
        "assisted booking keeps an explicit decision to avoid saving a health note",
      method: "POST",
      path: "/enrollments",
      body: {
        scheduleId: "session-a",
        memberId: "member-b",
        healthNotes: "Giảm tải",
        saveToProfile: false,
      },
      call: ({ enrollmentsApi }) =>
        enrollmentsApi.bookClass("session-a", {
          memberId: "member-b",
          healthNotes: "Giảm tải",
          saveToProfile: false,
        }),
    },
    {
      title: "whole-course registration omits optional member information",
      method: "POST",
      path: "/enrollments/bulk",
      body: { classId: "course-a" },
      call: ({ enrollmentsApi }) =>
        enrollmentsApi.enrollWholeCourse("course-a"),
    },
    {
      title:
        "whole-course registration keeps explicit nulls and profile consent",
      method: "POST",
      path: "/enrollments/bulk",
      body: {
        classId: "course-a",
        memberId: "member-b",
        goal: null,
        healthNotes: null,
        saveToProfile: true,
      },
      call: ({ enrollmentsApi }) =>
        enrollmentsApi.enrollWholeCourse("course-a", "member-b", {
          goal: null,
          healthNotes: null,
          saveToProfile: true,
        }),
    },
    {
      title: "course cancellation keeps the selected term scope",
      method: "POST",
      path: "/enrollments/courses/course-a/cancel",
      body: { termId: "term-b" },
      call: ({ enrollmentsApi }) =>
        enrollmentsApi.cancelWholeCourse("course-a", "term-b"),
    },
    {
      title:
        "course cancellation preserves the null term for courses outside a term",
      method: "POST",
      path: "/enrollments/courses/course%2Farchive/cancel",
      body: { termId: null },
      call: ({ enrollmentsApi }) =>
        enrollmentsApi.cancelWholeCourse("course/archive", null),
    },
    {
      title:
        "health note removal sends null and leaves the member profile alone by default",
      method: "PATCH",
      path: "/enrollments/enrollment-a/health-notes",
      body: { healthNotes: null, saveToProfile: false },
      call: ({ enrollmentsApi }) =>
        enrollmentsApi.updateHealthNotes("enrollment-a", null),
    },
    {
      title:
        "assisted transfer keeps the original enrollment and new session separate",
      method: "POST",
      path: "/enrollments/enrollment-a/transfer",
      body: { targetScheduleId: "session-b" },
      call: ({ enrollmentsApi }) =>
        enrollmentsApi.transferEnrollment("enrollment-a", "session-b"),
    },
    {
      title:
        "quota is queried for the current member without an identity override",
      method: "GET",
      path: "/enrollments/my/quota",
      call: ({ enrollmentsApi }) => enrollmentsApi.getMyQuota(),
    },
    {
      title: "attendance QR generation sends the selected session",
      method: "POST",
      path: "/attendance/generate-qr",
      body: { scheduleId: "session-a" },
      call: ({ api }) =>
        api("POST /attendance/generate-qr", {
          body: { scheduleId: "session-a" },
        }),
    },
  ];

  it.each(requests)(
    "$title",
    async ({ method, path, body, query = {}, call }) => {
      const returned = await call(await loadClients());
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [address, init] = fetchMock.mock.calls[0];
      const url = new URL(address);
      expect(url.pathname).toBe("/api/v1" + path);
      expect(Object.fromEntries(url.searchParams)).toEqual(query);
      expect(init.method).toBe(method);
      expect(init.headers).toMatchObject({
        Authorization: "Bearer fixture-member-token",
        "X-Facility-Id": "facility-a",
      });
      expect(
        body === undefined ? init.body : JSON.parse(String(init.body)),
      ).toEqual(body);
      expect([
        result,
        { success: true, data: result, message: "OK" },
      ]).toContainEqual(returned);
    },
  );
});

describe("SePay pending checkout recovery", () => {
  const details = {
    code: "SEPAY_PAYMENT_PENDING",
    paymentId: "payment-2",
    orderCode: "SEVQR2",
    amount: 300_000,
    expiresAt: "2027-01-01T00:15:00Z",
    qrUrl: "https://qr.example.invalid/order-2",
    transferContent: "SEVQR2",
  };

  it.each([
    {
      title: "accepts a complete conflict and defaults to VND and SePay",
      overrides: {},
      expected: { currency: "VND", gateway: "SEPAY", status: "PENDING" },
    },
    {
      title: "keeps the bank and snapshotted plan returned by the server",
      overrides: {
        bank: {
          id: "TESTBANK",
          accountNumber: "123",
          accountHolder: "Fixture",
        },
        plan: {
          id: "plan-a",
          name: "Gói đã chốt",
          tier: "MEMBERSHIP",
          durationDays: 30,
        },
      },
      expected: {
        bank: { accountNumber: "123" },
        plan: { name: "Gói đã chốt" },
      },
    },
    {
      title:
        "does not allow a conflicting status to promote the pending order to paid",
      overrides: { status: "SUCCESS" },
      expected: { status: "PENDING" },
    },
  ])("$title", async ({ overrides, expected }) => {
    const { sepayApi } = await loadClients();
    fetchMock.mockResolvedValue(
      Response.json(
        {
          success: false,
          message: "Existing order",
          errors: { ...details, ...overrides },
        },
        { status: 409 },
      ),
    );
    const checkout = await sepayApi
      .createCheckout("plan-b")
      .catch((error: unknown) => sepayApi.pendingCheckoutFromError(error));
    expect(checkout).toMatchObject({
      paymentId: "payment-2",
      orderCode: "SEVQR2",
      amount: 300_000,
      ...expected,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      title: "rejects a conflict for a different reason",
      status: 409,
      overrides: { code: "PLAN_NOT_AVAILABLE" },
    },
    {
      title: "rejects pending metadata outside an HTTP conflict",
      status: 503,
      overrides: {},
    },
    {
      title: "rejects a conflict without a payment identifier",
      status: 409,
      overrides: { paymentId: undefined },
    },
    {
      title: "rejects a conflict without an order code",
      status: 409,
      overrides: { orderCode: "" },
    },
    {
      title: "rejects a serialized string where the amount must be a number",
      status: 409,
      overrides: { amount: "300000" },
    },
    {
      title: "rejects a conflict without a QR destination",
      status: 409,
      overrides: { qrUrl: "" },
    },
    {
      title: "rejects a conflict without an expiry time",
      status: 409,
      overrides: { expiresAt: undefined },
    },
    {
      title: "rejects a conflict without transfer instructions",
      status: 409,
      overrides: { transferContent: "" },
    },
  ])("$title", async ({ status, overrides }) => {
    const { sepayApi } = await loadClients();
    fetchMock.mockResolvedValue(
      Response.json(
        {
          success: false,
          message: "Existing order",
          errors: { ...details, ...overrides },
        },
        { status },
      ),
    );
    await expect(
      sepayApi
        .createCheckout("plan-b")
        .catch((error: unknown) => sepayApi.pendingCheckoutFromError(error)),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("purchase and registration API failure handling", () => {
  it.each([
    {
      title: "keeps a package conflict available to the UI",
      status: 409,
      code: "PLAN_NOT_AVAILABLE",
      invoke: ({ sepayApi }: Api) => sepayApi.createCheckout("premium"),
    },
    {
      title: "keeps an enrollment conflict available to the UI",
      status: 409,
      code: "CLASS_FULL",
      invoke: ({ enrollmentsApi }: Api) =>
        enrollmentsApi.enrollWholeCourse("class-a"),
    },
    {
      title: "keeps a refund permission denial available to the UI",
      status: 403,
      code: "FORBIDDEN",
      invoke: ({ api }: Api) =>
        api("POST /payments/{id}/refund/confirm", {
          params: { id: "payment-a" },
          body: { reference: "R1", reason: "Fixture" },
        }),
    },
    {
      title: "keeps a refund concurrency conflict available to the UI",
      status: 409,
      code: "REFUND_ALREADY_REQUESTED",
      invoke: ({ api }: Api) =>
        api("POST /payments/{id}/refund/request", {
          params: { id: "payment-a" },
          body: { reason: "Fixture" },
        }),
    },
  ])("$title without replaying the write", async ({ status, code, invoke }) => {
    fetchMock.mockResolvedValue(
      Response.json(
        { success: false, message: "Workflow rejected", errors: { code } },
        { status },
      ),
    );
    await expect(invoke(await loadClients())).rejects.toMatchObject({
      status,
      details: { code },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps plan discovery filtered across all pages", async () => {
    fetchMock.mockImplementation(async (address) => {
      const query = new URL(address).searchParams;
      expect(query.get("isActive")).toBe("true");
      const page = Number(query.get("page"));
      return Response.json({
        success: true,
        data: [{ id: `plan-${page}` }],
        pagination: { page, totalPages: 2 },
      });
    });
    const { membershipApi } = await loadClients();
    await expect(membershipApi.getPlans()).resolves.toEqual({
      plans: [{ id: "plan-1" }, { id: "plan-2" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not return a partial subscription history when a later page fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: [{ id: "older-subscription" }],
          pagination: { page: 1, totalPages: 2 },
        }),
      )
      .mockResolvedValueOnce(response(null, 503, "Temporarily unavailable"));
    const { membershipApi } = await loadClients();
    await expect(
      membershipApi.getMySubscriptions("member-a"),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts a previous facility read and sends later requests in the new scope", async () => {
    const { sepayApi } = await loadClients();
    const { selectFacility } = await import("../src/shared/facility");
    fetchMock.mockImplementationOnce(
      async (_address, init) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener(
            "abort",
            () => reject(init.signal!.reason),
            { once: true },
          );
        }),
    );
    const first = sepayApi.getCheckout("order-old");
    const aborted = expect(first).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    selectFacility("facility-b");
    await aborted;
    await sepayApi.getCheckout("order-new");
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({
      "X-Facility-Id": "facility-b",
    });
  });
});

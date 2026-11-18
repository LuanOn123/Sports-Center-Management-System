import { cases, schemaCases, withFixture } from "./support.js";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { prisma } from "../../src/config/prisma.js";
import { requestContext } from "../../src/config/request-context.js";
import { authorize, authorizeExact } from "../../src/middlewares/authorize.js";
import { checkFacilityScope } from "../../src/middlewares/facilityScope.js";
import { AppError } from "../../src/middlewares/errorHandler.js";
import { ResetPasswordSchema } from "../../src/modules/auth/auth.schema.js";

cases("BR-AUTH-ROLE", [
  ["khách chưa đăng nhập bị từ chối ở hành động cần tài khoản", false, ["MEMBER"], null, 401],
  ["hội viên được phép đặt cho chính mình", true, ["MEMBER"], "MEMBER", 200],
  ["HLV không được đặt với quyền hội viên", true, ["MEMBER"], "COACH", 403],
  ["Admin không thay mặt vai trò hội viên ở route exact", true, ["MEMBER"], "ADMIN", 403],
  ["quản lý được phép thực hiện nhiệm vụ tại cơ sở", false, ["MANAGER"], "MANAGER", 200],
  ["Admin kế thừa quyền đọc/quản lý được khai báo", false, ["MANAGER"], "ADMIN", 200],
  ["lễ tân không kế thừa quyền quản lý", false, ["MANAGER"], "RECEPTIONIST", 403],
  ["lễ tân được dùng nghiệp vụ quầy chỉ dành cho lễ tân", true, ["RECEPTIONIST"], "RECEPTIONIST", 200],
  ["Admin không kế thừa thao tác quầy được khai báo exact", true, ["RECEPTIONIST"], "ADMIN", 403],
  ["đường hoàn tiền thực tế cho phép Admin được liệt kê rõ", true, ["ADMIN", "RECEPTIONIST"], "ADMIN", 200],
  ["đường hoàn tiền thực tế không cấp quyền cho Manager", true, ["ADMIN", "RECEPTIONIST"], "MANAGER", 403],
  ["HLV được ghi nghiệp vụ giáo án dành cho HLV", true, ["COACH"], "COACH", 200],
] as const, ([, exact, roles, role, expected]) => {
  let status: number | undefined;
  let nextCalls = 0;
  const response = {
    status(value: number) { status = value; return this; },
    json(data: { success?: boolean }) { assert.equal(data.success, false); },
  } as unknown as Response;
  const request = { user: role ? { id: "actor", role } : undefined } as Request;
  const guard = exact ? authorizeExact(...roles) : authorize(...roles);
  guard(request, response, () => { nextCalls++; });
  assert.deepEqual([status, nextCalls], expected === 200 ? [undefined, 1] : [expected, 0]);
});

type ScopeSetup = {
  role: string; headers?: string; query?: string; body?: string; path?: string;
  assignments?: number; active?: boolean; coachAssigned?: boolean; report?: boolean; method?: string;
};
cases<readonly [string, ScopeSetup, string | number | null]>("BR-AUTH-FACILITY", [
  ["Manager lấy cơ sở từ phân công khi header trống", { role: "MANAGER" }, "facility-a"],
  ["Manager không thể đổi cơ sở bằng header", { role: "MANAGER", headers: "facility-b" }, 403],
  ["Manager không thể đổi cơ sở bằng query", { role: "MANAGER", query: "facility-b" }, 403],
  ["lễ tân không thể đổi cơ sở bằng payload", { role: "RECEPTIONIST", body: "facility-b" }, 403],
  ["lễ tân thiếu cơ sở phân công bị chặn", { role: "RECEPTIONIST", assignments: 0 }, 403],
  ["Manager có phân công mơ hồ bị chặn", { role: "MANAGER", assignments: 2 }, 403],
  ["hội viên có thể chọn cơ sở đang hoạt động", { role: "MEMBER", headers: "facility-b" }, "facility-b"],
  ["hội viên không thể thao tác ở cơ sở ngừng hoạt động", { role: "MEMBER", headers: "facility-b", active: false }, 403],
  ["Admin không thể dùng context xung đột cho báo cáo scoped", { role: "ADMIN", headers: "facility-a", query: "facility-b" }, 400],
  ["Admin có báo cáo hội viên toàn hệ thống khi không chọn cơ sở", { role: "ADMIN", report: true }, null],
  ["Admin xem các lớp toàn hệ thống khi không có context", { role: "ADMIN" }, null],
  ["Admin lọc theo cơ sở đang hoạt động", { role: "ADMIN", headers: "facility-b" }, "facility-b"],
  ["Admin xem được dữ liệu cơ sở ngừng hoạt động", { role: "ADMIN", headers: "facility-b", active: false }, "facility-b"],
  ["Admin phải chọn cơ sở khi tạo lớp mới", { role: "ADMIN", method: "POST" }, 400],
  ["hội viên vẫn cần context cơ sở", { role: "MEMBER" }, 400],
  ["HLV có phân công hoạt động được truy cập cơ sở", { role: "COACH", headers: "facility-a", coachAssigned: true }, "facility-a"],
  ["HLV không có phân công bị chặn khi chọn cơ sở", { role: "COACH", headers: "facility-a", coachAssigned: false }, 403],
], async ([, setup, expected]) => {
  const request = {
    user: { id: "actor", role: setup.role }, method: setup.method ?? "GET",
    originalUrl: setup.report ? "/api/v1/reports/memberships" : "/api/v1/classes",
    params: { facilityId: setup.path }, query: { facilityId: setup.query },
    body: { facilityId: setup.body }, get: () => setup.headers,
  } as unknown as Request;
  await withFixture([
    [prisma.facilityStaff, "findMany", async ({ where }) => {
      assert.deepEqual(where, { userId: "actor", role: setup.role, isActive: true, facility: { isActive: true } });
      return Array.from({ length: setup.assignments ?? 1 }, () => ({ facilityId: "facility-a" }));
    }],
    [prisma.facility, "findUnique", async () => ({ isActive: setup.active !== false })],
    [prisma.facilityStaff, "findFirst", async ({ where }) => {
      assert.deepEqual(where, { facilityId: setup.headers, userId: "actor", role: "COACH", isActive: true });
      return setup.coachAssigned ? { id: "coach-assigned" } : null;
    }],
  ], async () => {
    const observed: Array<string | number | null> = [];
    await checkFacilityScope(request, {} as Response, (error?: unknown) => {
      if (error !== undefined) {
        assert.ok(error instanceof AppError);
        observed.push(error.statusCode);
      } else {
        assert.equal(requestContext.getStore()?.actorId, "actor");
        observed.push(requestContext.getStore()?.facilityId ?? null);
      }
    });
    assert.deepEqual(observed, [expected]);
    assert.equal(requestContext.getStore(), undefined, "facility scope must not leak to the next request");
  });
});

const reset = { email: "member@example.invalid", newPassword: "new-fixture-password", otp: "012345" };
cases("BR-ADMIN-GLOBAL-UPDATE", ["rooms", "classes", "payments"] as const, async (resource) => {
  const delegate = resource === "rooms" ? prisma.room : resource === "classes" ? prisma.class : prisma.payment;
  await withFixture([
    [delegate, "findUnique", async ({ where }) => {
      assert.equal(where.id, "resource-a");
      return { facilityId: "facility-b" };
    }],
    [prisma.facility, "findUnique", async ({ where }) => {
      assert.equal(where.id, "facility-b");
      return { isActive: true };
    }],
  ], async () => {
    const request = {
      user: { id: "admin", role: "ADMIN" }, method: "PATCH",
      originalUrl: `/api/v1/${resource}/resource-a`,
      params: {}, query: {}, body: {}, get: () => undefined,
    } as unknown as Request;
    let called = false;
    await checkFacilityScope(request, {} as Response, (error) => {
      assert.equal(error, undefined);
      called = true;
      assert.equal(requestContext.getStore()?.facilityId, "facility-b");
    });
    assert.equal(called, true);
  });
});
schemaCases("BR-AUTH-OTP", ResetPasswordSchema, [
  ["OTP cho phép số 0 ở đầu", reset, true],
  ["OTP không đủ 6 ký tự không được đổi mật khẩu", { ...reset, otp: "12345" }, false, "otp"],
  ["OTP không nhận chữ", { ...reset, otp: "ABCDEF" }, false, "otp"],
  ["mật khẩu sau khôi phục vẫn phải đạt độ dài tối thiểu", { ...reset, newPassword: "12345" }, false, "newPassword"],
]);

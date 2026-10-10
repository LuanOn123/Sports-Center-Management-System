import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ facilityStaff: { findMany: vi.fn() } }));
vi.mock("../../BE/src/config/prisma.js", () => ({ prisma: db }));
import { checkFacilityScope } from "../../BE/src/middlewares/facilityScope";
import { requestContext } from "../../BE/src/config/request-context";

beforeEach(() => {
  vi.resetAllMocks();
  db.facilityStaff.findMany.mockResolvedValue([{ facilityId: "facility-a" }]);
});
async function check(
  input: {
    params?: object;
    query?: object;
    body?: object;
    header?: string;
  } = {},
) {
  const next = vi.fn((error?: unknown) => ({
    error,
    context: requestContext.getStore(),
  }));
  await checkFacilityScope(
    {
      user: { id: "manager-a", role: "MANAGER" },
      params: input.params ?? {},
      query: input.query ?? {},
      body: input.body,
      get: () => input.header,
    } as any,
    {} as any,
    next,
  );
  return next.mock.results[0].value;
}
describe("Manager facility scope", () => {
  it("derives facility from active assignment without any client facility", async () => {
    const result = await check();
    expect(result.error).toBeUndefined();
    expect(result.context).toMatchObject({
      facilityId: "facility-a",
      actorId: "manager-a",
      role: "MANAGER",
    });
    expect(db.facilityStaff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "manager-a",
          role: "MANAGER",
          isActive: true,
          facility: { isActive: true },
        },
      }),
    );
  });
  it.each([
    { params: { facilityId: "facility-b" } },
    { query: { facilityId: "facility-b" } },
    { body: { facilityId: "facility-b" } },
    { header: "facility-b" },
    { query: { facilityId: ["facility-a", "facility-b"] } },
    { body: { facilityId: null } },
    { header: "" },
  ])("rejects tampered scope %j", async (input) => {
    const result = await check(input);
    expect(result.error).toMatchObject({
      statusCode: 403,
      message: "FORBIDDEN_SCOPE",
    });
    expect(result.context).toBeUndefined();
  });
  it("accepts matching compatibility header/query but still uses DB assignment", async () => {
    expect(
      (
        await check({
          header: "facility-a",
          query: { facilityId: "facility-a" },
        })
      ).context.facilityId,
    ).toBe("facility-a");
  });
  it.each([
    { assignments: [] },
    { assignments: [{ facilityId: "a" }, { facilityId: "b" }] },
  ])(
    "fails closed when assignment is missing or ambiguous: %j",
    async ({ assignments }) => {
      db.facilityStaff.findMany.mockResolvedValue(assignments);
      expect((await check()).error).toMatchObject({
        statusCode: 403,
        message: "MANAGER_FACILITY_REQUIRED",
      });
    },
  );
});

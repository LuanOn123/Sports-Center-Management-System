const text = { type: "string" };
const integer = { type: "integer" };
const list = (items: any) => ({ type: "array", items });
const object = (properties: any, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  // OpenAPI cấm `required: []` (phải ≥1 phần tử) — bỏ hẳn khi rỗng.
  ...(required.length ? { required } : {}),
});
const enumOf = (...values: string[]) => ({ type: "string", enum: values });
const time = { type: "string", format: "date-time" };
const facility = object(
  {
    code: text,
    name: text,
    address: text,
    contactInfo: text,
    timezone: { ...text, default: "Asia/Ho_Chi_Minh" },
  },
  ["code", "name", "address"],
);
const quantities = object({
  values: {
    type: "object",
      additionalProperties: { oneOf: [{ type: "integer", minimum: 0 }, { type: "boolean" }] },
  },
});
const entries: [string, string, string, any?][] = [
  ["get", "/classes/{id}/registrations", "Hội viên đã đăng ký khóa học (staff)"],
  ["get", "/reports/facilities", "Tổng quan toàn hệ thống theo cơ sở (ADMIN)"],
  ["put", "/facilities/{facilityId}/manager", "Thêm hoặc thay quản lý cơ sở (ADMIN)", object({ userId: text, replacedUserId: text }, ["userId"])],
  ["get", "/staff-candidates", "Nhân sự có thể phân công"],
  ["get", "/coaches/{id}/specializations", "Chuyên môn huấn luyện viên"],
  ["get", "/leave-requests/{id}/affected", "Buổi học cần xử lý khi nghỉ phép"],
  ["get", "/facilities", "Danh sách cơ sở"],
  ["post", "/facilities", "Tạo cơ sở", facility],
  ["get", "/facilities/{facilityId}", "Chi tiết cơ sở"],
  [
    "put",
    "/facilities/{facilityId}",
    "Sửa cơ sở",
    object({ ...facility.properties, isActive: { type: "boolean" } }, []),
  ],
  [
    "post",
    "/facilities/{facilityId}/staff",
    "Phân công nhân sự",
    object({ userId: text, role: enumOf("MANAGER", "COACH", "RECEPTIONIST") }),
  ],
  ["delete", "/facilities/{facilityId}/staff/{userId}/{role}", "Gỡ phân công"],
  ["put", "/rooms/{id}/capabilities", "Thiết bị và khả năng phòng", quantities],
  ["put", "/subjects/{id}/requirements", "Yêu cầu bộ môn", quantities],
  [
    "put",
    "/coaches/{id}/specializations",
    "Chuyên môn huấn luyện viên",
    object({ sportIds: list(text) }),
  ],
  ["get", "/slots", "Khung giờ"],
  [
    "post",
    "/slots",
    "Tạo khung giờ",
    object({ name: text, startMinute: integer, endMinute: integer }),
  ],
  ["get", "/schedule-patterns", "Lịch lặp"],
  [
    "post",
    "/schedule-patterns",
    "Sinh lịch lặp",
    object({
      classId: text,
      roomId: text,
      slotId: text,
      weekdays: list(integer),
      startDate: { ...text, format: "date" },
      endDate: { ...text, format: "date" },
    }),
  ],
  ["get", "/leave-requests", "Đơn nghỉ phép"],
  [
    "post",
    "/leave-requests",
    "Gửi đơn nghỉ phép",
    object({ startTime: time, endTime: time, reason: text }),
  ],
  [
    "patch",
    "/leave-requests/{id}",
    "Duyệt đơn và xử lý lịch",
    object({
      status: enumOf("APPROVED", "REJECTED"),
      reason: text,
      resolutions: list(
        object(
          {
            scheduleId: text,
            action: enumOf("REPLACE", "MOVE", "CANCEL"),
            coachId: text,
            roomId: text,
            startTime: time,
            endTime: time,
          },
          ["scheduleId", "action"],
        ),
      ),
    }),
  ],
  ["get", "/issues", "Yêu cầu hỗ trợ"],
  ["get", "/issues/{id}", "Chi tiết yêu cầu"],
  [
    "post",
    "/issues",
    "Gửi yêu cầu",
    object({ title: text, description: text }),
  ],
  [
    "put",
    "/issues/{id}",
    "Sửa yêu cầu đang mở",
    object({ title: text, description: text }),
  ],
  ["delete", "/issues/{id}", "Xóa yêu cầu đang mở"],
  [
    "patch",
    "/issues/{id}",
    "Phản hồi yêu cầu",
    object({
      status: enumOf("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"),
      response: text,
    }),
  ],
  ["get", "/audit-logs", "Nhật ký hoạt động"],
  ["get", "/counter-orders", "Đơn bán tại quầy"],
  [
    "post",
    "/counter-orders",
    "Tạo đơn chờ thanh toán",
    object(
      {
        memberId: text,
        planId: text,
        method: enumOf("CASH", "BANK_TRANSFER"),
        note: text,
      },
      ["memberId", "planId", "method"],
    ),
  ],
  [
    "post",
    "/counter-orders/{id}/confirm",
    "Xác nhận thu tiền và kích hoạt gói",
    object({ reason: text }),
  ],
];
export function addOperations(spec: any) {
  for (const [method, path, summary, body] of entries) {
    spec.paths[path] ||= {};
    spec.paths[path][method] = {
      summary,
      tags: ["Facility Operations"],
      security: [{ BearerAuth: [] }],
      parameters: [
        ...Array.from(path.matchAll(/\{(\w+)\}/g), (match) => ({
          name: match[1],
          in: "path",
          required: true,
          schema: text,
        })),
        ...(path === "/facilities"
          ? [{ name: "includeInactive", in: "query", schema: { type: "string", enum: ["true", "false"] } }]
          : [
              {
                name: "X-Facility-Id",
                in: "header",
                required: !path.startsWith("/facilities/"),
                schema: text,
              },
            ]),
        ...(path === "/audit-logs"
          ? [{ name: "skip", in: "query", schema: integer }, { name: "entity", in: "query", schema: text }, { name: "filterFacilityId", in: "query", schema: text }]
          : []),
        ...(path === "/reports/facilities" ? ["startDate", "endDate"].map(name => ({ name, in: "query", required: true, schema: text })) : []),
      ],
      ...(body
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: body } },
            },
          }
        : {}),
      responses: {
        "200": { description: "Success" },
        "400": { description: "Invalid or missing facility context" },
        "403": { description: "Forbidden role or facility scope" },
        "409": { description: "Business rule conflict" },
      },
    };
  }
  for (const method of ["post", "patch"]) {
    const properties = spec.paths[method === "post" ? "/classes" : "/classes/{id}"]?.[method]?.requestBody?.content?.["application/json"]?.schema?.properties;
    if (properties) properties.defaultRoomId = { type: "string", description: "Phòng mặc định cùng cơ sở, đúng khu vực và đủ sức chứa. Lịch học có thể chọn phòng phù hợp khác." };
  }
  // Subject uses the established Sport model and public API compatibility alias.
  for (const [path, operations] of Object.entries(spec.paths))
    if (path.startsWith("/sports"))
      spec.paths[path.replace("/sports", "/subjects")] = operations;
}

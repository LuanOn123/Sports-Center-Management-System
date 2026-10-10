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
    additionalProperties: {
      oneOf: [{ type: "integer", minimum: 0 }, { type: "boolean" }],
    },
  },
});
const entries: [string, string, string, any?][] = [
  [
    "get",
    "/attendance/monitoring",
    "Chuyên cần hội viên theo lớp trong cơ sở (Reception/Manager)",
  ],
  [
    "get",
    "/attendance/monitoring/detail",
    "Lịch sử chuyên cần của hội viên trong lớp đã đăng ký",
  ],
  [
    "post",
    "/attendance/warnings/send",
    "Gửi cảnh báo chuyên cần, chống gửi trùng",
    object({ memberId: text, classId: text }),
  ],
  [
    "post",
    "/attendance/reports",
    "Lễ tân báo cáo vi phạm từ 30%",
    object({
      memberId: text,
      classId: text,
      reason: { ...text, minLength: 5, maxLength: 1000 },
    }),
  ],
  [
    "post",
    "/attendance/reports/{id}/review",
    "Manager duyệt báo cáo chuyên cần",
    object({
      decision: enumOf("APPROVE_REMOVAL", "REJECT"),
      response: { ...text, minLength: 5, maxLength: 1000 },
    }),
  ],

  [
    "get",
    "/classes/{id}/registrations",
    "Hội viên đã đăng ký khóa học (staff)",
  ],
  ["get", "/reports/facilities", "Tổng quan toàn hệ thống theo cơ sở (ADMIN)"],
  [
    "put",
    "/facilities/{facilityId}/manager",
    "Thêm hoặc thay quản lý cơ sở (ADMIN)",
    object({ userId: text, replacedUserId: text }, ["userId"]),
  ],
  [
    "get",
    "/staff-candidates",
    "Ứng viên chưa phân công: Coach cho MANAGER, Manager cho ADMIN",
  ],
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
  [
    "post",
    "/facilities/{facilityId}/coaches",
    "Manager tạo tài khoản HLV kèm bộ môn",
    object(
      {
        email: text,
        fullName: text,
        password: text,
        phone: text,
        gender: enumOf("MALE", "FEMALE", "OTHER"),
        dateOfBirth: text,
        experienceYears: integer,
        specialization: text,
        bio: text,
        sportIds: list(text),
      },
      ["email", "fullName", "sportIds"],
    ),
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
      description:
        (path.startsWith("/leave-requests")
          ? "Coach và Receptionist gửi/đọc đơn của chính mình; Manager/Admin duyệt trong phạm vi được phép. requesterId/requesterRole lấy từ tài khoản đăng nhập. coachId nullable cho lễ tân; affected trả [] và không nhận resolutions cho đơn này. Danh sách bổ sung requester {id, fullName, role}. "
          : path.startsWith("/issues")
            ? "Member, Coach, Receptionist và Manager có thể gửi yêu cầu; người gửi do server xác định. Member/Coach chỉ đọc yêu cầu của mình; Manager/Receptionist xử lý trong cơ sở. Danh sách bổ sung requester {id, fullName, role}; giữ memberId cho yêu cầu Member cũ. "
            : "") +
        "MANAGER: cơ sở được xác định từ phân công đang hoạt động trong DB; facilityId/header khác cơ sở đó bị từ chối 403. Phân công Coach đã có cơ sở hoặc thêm Manager thứ hai vào cơ sở trả 409.",
      tags: ["Facility Operations"],
      security: [{ BearerAuth: [] }],
      parameters: [
        ...(path === "/attendance/monitoring"
          ? [
              ...["memberId", "classId", "search"].map((name) => ({
                name,
                in: "query",
                schema: text,
              })),
              {
                name: "status",
                in: "query",
                schema: enumOf("NORMAL", "WARNING", "VIOLATION"),
              },
              { name: "page", in: "query", schema: { ...integer, minimum: 1 } },
              {
                name: "limit",
                in: "query",
                schema: { ...integer, minimum: 1, maximum: 100 },
              },
            ]
          : path === "/attendance/monitoring/detail"
            ? ["memberId", "classId"].map((name) => ({
                name,
                in: "query",
                required: true,
                schema: text,
              }))
            : []),
        ...Array.from(path.matchAll(/\{(\w+)\}/g), (match) => ({
          name: match[1],
          in: "path",
          required: true,
          schema: text,
        })),
        ...(path === "/facilities"
          ? [
              {
                name: "includeInactive",
                in: "query",
                schema: { type: "string", enum: ["true", "false"] },
              },
            ]
          : [
              {
                name: "X-Facility-Id",
                in: "header",
                required: false,
                description:
                  "Không bắt buộc với MANAGER. Các role khác phải truyền cơ sở bằng header hoặc facilityId trên path/query/body như quy định của endpoint.",
                schema: text,
              },
            ]),
        ...(path === "/audit-logs"
          ? [
              { name: "skip", in: "query", schema: integer },
              { name: "entity", in: "query", schema: text },
              { name: "filterFacilityId", in: "query", schema: text },
            ]
          : []),
        ...(path === "/reports/facilities"
          ? ["startDate", "endDate"].map((name) => ({
              name,
              in: "query",
              required: true,
              schema: text,
            }))
          : []),
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
    const properties =
      spec.paths[method === "post" ? "/classes" : "/classes/{id}"]?.[method]
        ?.requestBody?.content?.["application/json"]?.schema?.properties;
    if (properties)
      properties.defaultRoomId = {
        type: "string",
        description:
          "Phòng mặc định cùng cơ sở, đúng khu vực và đủ sức chứa. Lịch học có thể chọn phòng phù hợp khác.",
      };
  }
  // Subject uses the established Sport model and public API compatibility alias.
  for (const [path, operations] of Object.entries(spec.paths))
    if (path.startsWith("/sports"))
      spec.paths[path.replace("/sports", "/subjects")] = operations;
}

import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import {
  CheckInSchema,
  ReceptionCheckInSchema,
  VisitQuerySchema,
} from "./facility-visits.schema.js";
import * as controller from "./facility-visits.controller.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Facility Visits
 *   description: Check-in vào cơ sở & lịch sử lượt vào cửa
 */

/**
 * @swagger
 * /facility-visits/check-in:
 *   post:
 *     summary: "Member tự check-in vào cơ sở đang chọn (method QR mặc định)"
 *     description: |
 *       FACILITY-scope — facility lấy từ header `X-Facility-Id` (body KHÔNG chứa
 *       facilityId); thiếu → 400 `FACILITY_CONTEXT_REQUIRED`.
 *       - Cần một gói ACTIVE (kể cả FREE); không có gói → 403. Facility không tồn tại → 404,
 *         facility `isActive = false` → 403 `FORBIDDEN_SCOPE`.
 *       - Dedupe 5 phút cùng facility: nếu vừa check-in → trả **200** kèm visit cũ
 *         (`duplicate: true`), không tạo bản mới.
 *       - Không có MemberProfile → 404; tài khoản bị khóa → 400. Không gửi body → 400
 *         validation (gửi `{}` nếu không kèm tham số).
 *     tags: [Facility Visits]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               method: { type: string, enum: [QR, RECEPTION], default: QR }
 *     responses:
 *       200: { description: "Already checked in recently — trả về lượt check-in gần nhất (dedupe 5 phút)" }
 *       201: { description: "Checked in successfully" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post(
  "/check-in",
  authenticate,
  authorize("MEMBER"),
  validate(CheckInSchema),
  controller.selfCheckIn,
);

/**
 * @swagger
 * /facility-visits/reception-check-in:
 *   post:
 *     summary: "Lễ tân check-in hộ member (MANAGER/RECEPTIONIST)"
 *     description: |
 *       Cùng luồng với self check-in (entitlement GLOBAL, dedupe 5 phút, cần gói ACTIVE),
 *       khác ở chỗ chỉ định member qua `memberId` (id hoặc userId của MemberProfile) và
 *       `method` mặc định `RECEPTION`.
 *       FACILITY-scope — facility lấy từ header `X-Facility-Id`.
 *     tags: [Facility Visits]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [memberId]
 *             properties:
 *               memberId: { type: string, description: "MemberProfile id hoặc userId" }
 *               method: { type: string, enum: [QR, RECEPTION], default: RECEPTION }
 *     responses:
 *       200: { description: "Already checked in recently (dedupe 5 phút)" }
 *       201: { description: "Checked in successfully" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post(
  "/reception-check-in",
  authenticate,
  authorize("MANAGER", "RECEPTIONIST"),
  validate(ReceptionCheckInSchema),
  controller.receptionCheckIn,
);

/**
 * @swagger
 * /facility-visits/my:
 *   get:
 *     summary: "Lịch sử vào cửa của CHÍNH member (mọi cơ sở)"
 *     description: |
 *       GLOBAL — DAL được nới scope (`facilityId: undefined`) nên trả về lượt vào cửa tại
 *       MỌI cơ sở của member. Vẫn thuộc root FACILITY-scope nên request phải mang facility
 *       context (header `X-Facility-Id`).
 *     tags: [Facility Visits]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *         description: checkInAt >= from
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *         description: checkInAt <= to
 *     responses:
 *       200: { description: "Visits retrieved successfully (kèm pagination)" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get(
  "/my",
  authenticate,
  authorize("MEMBER"),
  validate(VisitQuerySchema, "query"),
  controller.getMyVisitHistory,
);

/**
 * @swagger
 * /facility-visits:
 *   get:
 *     summary: "Danh sách lượt vào cửa của cơ sở đang chọn (staff)"
 *     description: |
 *       FACILITY-SCOPED qua DAL — chỉ trả về lượt vào cửa tại facility đang chọn
 *       (header `X-Facility-Id`). Lọc theo member (`memberId` = id hoặc userId),
 *       khoảng thời gian `from`/`to` trên `checkInAt`.
 *     tags: [Facility Visits]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *       - in: query
 *         name: memberId
 *         schema: { type: string }
 *         description: MemberProfile id hoặc userId
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: "Visits retrieved successfully (kèm pagination)" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get(
  "/",
  authenticate,
  authorize("MANAGER", "RECEPTIONIST"),
  validate(VisitQuerySchema, "query"),
  controller.listFacilityVisits,
);

export default router;

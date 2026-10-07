import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { JoinWaitlistSchema, WaitlistQuerySchema } from "./waitlist.schema.js";
import * as controller from "./waitlist.controller.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Waitlist
 *   description: Hàng chờ khi buổi học đã đầy
 */

/**
 * @swagger
 * /waitlist:
 *   post:
 *     summary: "Member vào hàng chờ cho buổi đã FULL"
 *     description: |
 *       Chỉ nhận khi buổi `SCHEDULED`, chưa bắt đầu và ĐÃ ĐẦY (còn slot → 409 yêu cầu book
 *       thẳng). Bảo đảm 1 mục WAITING/(member × buổi) — unique từng phần trong DB: đã chờ →
 *       409; đã BOOKED/COMPLETED buổi này → 409. `position` = max(position WAITING của buổi)
 *       + 1 trong lock schedule (tăng dần, không có API sửa tay).
 *       FACILITY-scope — facility lấy từ header `X-Facility-Id`.
 *       Lưu ý: vào chờ KHÔNG trừ quota; khi có slot trống, promotion chạy trong transaction
 *       hủy chỗ và TÁI KIỂM TRA quota/điều kiện đặt (`assertCanBook`) trước khi xếp lên.
 *     tags: [Waitlist]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scheduleId]
 *             properties:
 *               scheduleId: { type: string }
 *     responses:
 *       201: { description: "Joined waitlist successfully" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       409: { $ref: "#/components/responses/Conflict" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post(
  "/",
  authenticate,
  authorize("MEMBER"),
  validate(JoinWaitlistSchema),
  controller.joinScheduleWaitlist,
);

/**
 * @swagger
 * /waitlist/{id}:
 *   delete:
 *     summary: "Member hủy mục chờ của chính mình (WAITING → CANCELLED, CAS)"
 *     description: |
 *       Chỉ hủy được mục CHÍNH mình còn đang `WAITING` (updateMany CAS theo
 *       id + memberId + status); không phải mục của mình / đã kết thúc → 404.
 *       Không ảnh hưởng quota hay booking; không có tác dụng với mục đã PROMOTED.
 *     tags: [Waitlist]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "Left waitlist successfully" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.delete(
  "/:id",
  authenticate,
  authorize("MEMBER"),
  controller.leaveWaitlist,
);

/**
 * @swagger
 * /waitlist/my:
 *   get:
 *     summary: "Lịch sử hàng chờ của CHÍNH member (mọi cơ sở)"
 *     description: |
 *       GLOBAL — mọi mục chờ của member, lọc theo `scheduleId` và `status`.
 *       Vẫn thuộc root FACILITY-scope nên request phải mang facility context
 *       (header `X-Facility-Id`).
 *     tags: [Waitlist]
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
 *         name: scheduleId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [WAITING, PROMOTED, CANCELLED] }
 *     responses:
 *       200: { description: "Waitlist retrieved successfully (kèm pagination)" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get(
  "/my",
  authenticate,
  authorize("MEMBER"),
  validate(WaitlistQuerySchema, "query"),
  controller.getMyWaitlistHistory,
);

/**
 * @swagger
 * /waitlist/schedule/{scheduleId}:
 *   get:
 *     summary: "Staff xem waitlist của 1 buổi (MANAGER/RECEPTIONIST/COACH)"
 *     description: |
 *       FACILITY-SCOPED qua DAL (Schedule → Class → facility đang chọn) — thiếu
 *       `X-Facility-Id` → 400 `FACILITY_CONTEXT_REQUIRED`. Sắp xếp theo
 *       status rồi `position` (thứ tự ưu tiên xếp lớp).
 *     tags: [Waitlist]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [WAITING, PROMOTED, CANCELLED] }
 *     responses:
 *       200: { description: "Waitlist retrieved successfully (kèm pagination)" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get(
  "/schedule/:scheduleId",
  authenticate,
  authorize("MANAGER", "RECEPTIONIST", "COACH"),
  validate(WaitlistQuerySchema, "query"),
  controller.getScheduleWaitlist,
);

export default router;

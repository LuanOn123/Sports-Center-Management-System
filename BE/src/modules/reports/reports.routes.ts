import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { DateRangeSchema, AttendanceReportQuerySchema } from "./reports.schema.js";
import * as reportsController from "./reports.controller.js";

const router = Router();

router.use(authenticate, authorize("MANAGER"));

/**
 * @swagger
 * /reports/revenue:
 *   get:
 *     summary: Revenue report (total, by method, recent payments)
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, example: "2026-01-01" }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, example: "2026-12-31" }
 *     responses:
 *       200: { $ref: "#/components/responses/RevenueReportOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get("/revenue", validate(DateRangeSchema, "query"), reportsController.getRevenueReport);

/**
 * @swagger
 * /reports/members:
 *   get:
 *     summary: Member report (total, new, active, by tier)
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/MemberReportOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get("/members", validate(DateRangeSchema, "query"), reportsController.getMemberReport);

/**
 * @swagger
 * /reports/enrollments:
 *   get:
 *     summary: Enrollment report (top classes, by type)
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/EnrollmentReportOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get("/enrollments", validate(DateRangeSchema, "query"), reportsController.getEnrollmentReport);

/**
 * @swagger
 * /reports/memberships:
 *   get:
 *     summary: Membership subscription report (by status, tier, revenue)
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/MembershipReportOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get("/memberships", validate(DateRangeSchema, "query"), reportsController.getMembershipReport);

/**
 * @swagger
 * /reports/subscription-logs:
 *   get:
 *     summary: Detailed log of subscription purchases
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { $ref: "#/components/responses/SubscriptionLogListOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
/**
 * @swagger
 * /reports/attendance:
 *   get:
 *     summary: Attendance report per (member × class) with FIXED allowance or RECURRING fallback
 *     description: |
 *       FIXED (Class.attendancePolicy = FIXED + plannedSessionCount > 0, snapshot cố định):
 *       allowance = floor(plannedSessionCount × 20%);
 *       currentAbsences (ABSENT + NO_SHOW đã chốt) < allowance -> NORMAL;
 *       == allowance -> NOTICE; > allowance -> WARNING. Đánh giá sớm sau mỗi buổi chốt.
 *       Thêm schedule sau này KHÔNG làm tăng snapshot (amendment phải tạo Class/cohort mới).
 *       RECURRING (mọi trường hợp còn lại): rolling tối đa 10 buổi đã kết thúc;
 *       sampleSize < 5 -> NORMAL; rate >= 80% -> NORMAL; 70–<80% -> NOTICE; < 70% -> WARNING.
 *       rate = (PRESENT + LATE) / (PRESENT + LATE + ABSENT + NO_SHOW); EXCUSED/cancelled/tương lai loại.
 *       NOTICE/WARNING chỉ gửi thông báo tham khảo; Penalty là quyết định thủ công riêng của Manager.
 *       Hàng FIXED có thêm policy/totalPlannedSessions/completedSessions/currentAbsences/allowedAbsences/remainingAbsences.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NORMAL, NOTICE, WARNING] }
 *       - in: query
 *         name: classId
 *         schema: { type: string }
 *       - in: query
 *         name: memberId
 *         schema: { type: string, description: MemberProfile.id }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Attendance report
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Attendance report retrieved successfully
 *               data:
 *                 summary: { total: 12, normal: 9, notice: 2, warning: 1 }
 *                 rows:
 *                   - memberId: "member-uuid"
 *                     memberName: "Nguyễn Văn A"
 *                     classId: "class-uuid"
 *                     className: "Yoga cơ bản"
 *                     policy: "FIXED"
 *                     totalPlannedSessions: 10
 *                     completedSessions: 5
 *                     currentAbsences: 2
 *                     allowedAbsences: 2
 *                     remainingAbsences: 0
 *                     sampleSize: 8
 *                     presentCount: 5
 *                     lateCount: 0
 *                     absentCount: 2
 *                     noShowCount: 1
 *                     excusedCount: 1
 *                     attendanceRate: 62.5
 *                     status: WARNING
 *                     activePenalty: null
 *               pagination: { page: 1, limit: 20, total: 12, totalPages: 1 }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get(
  "/attendance",
  validate(AttendanceReportQuerySchema, "query"),
  reportsController.getAttendanceReport
);

router.get("/subscription-logs", reportsController.getSubscriptionLogs);

/**
 * @swagger
 * /reports/cross-facility-usage:
 *   get:
 *     summary: Cross-facility usage (origin vs actual usage)
 *     description: |
 *       "Member mua gói ở A đang dùng ở đâu?" — origin = Subscription.facilityId,
 *       usage = Class.facilityId của Enrollment / Facility.facilityId của Visit.
 *       Không đổi model subscription, không tạo bảng mới.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Cross-facility usage report }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get(
  "/cross-facility-usage",
  validate(DateRangeSchema, "query"),
  reportsController.getCrossFacilityUsage,
);

export default router;

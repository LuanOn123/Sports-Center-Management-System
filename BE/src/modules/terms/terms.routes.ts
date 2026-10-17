import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize, authorizeExact } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import {
  CreateTermSchema,
  UpdateTermSchema,
  TermQuerySchema,
} from "./terms.schema.js";
import * as termsController from "./terms.controller.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Terms
 *   description: Quản lý kỳ học / chu kỳ (Semesters / Cycles) do Admin cấu hình
 */

/**
 * @swagger
 * /terms:
 *   get:
 *     summary: Lấy danh sách kỳ học (hoặc kỳ hiện tại với ?current=true)
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "MANAGER", "COACH", "RECEPTIONIST", "MEMBER"),
  validate(TermQuerySchema, "query"),
  termsController.listTerms
);

/**
 * @swagger
 * /terms/current:
 *   get:
 *     summary: Lấy thông tin kỳ học hiện tại
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/current",
  authenticate,
  authorize("ADMIN", "MANAGER", "COACH", "RECEPTIONIST", "MEMBER"),
  termsController.getCurrentTerm
);

/**
 * @swagger
 * /terms/{id}:
 *   get:
 *     summary: Xem chi tiết kỳ học
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "MANAGER", "COACH", "RECEPTIONIST", "MEMBER"),
  termsController.getTermById
);

/**
 * @swagger
 * /terms:
 *   post:
 *     summary: Tạo kỳ học mới (Chỉ dành cho ADMIN)
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/",
  authenticate,
  authorizeExact("ADMIN"),
  validate(CreateTermSchema),
  termsController.createTerm
);

/**
 * @swagger
 * /terms/{id}:
 *   patch:
 *     summary: Cập nhật kỳ học (Chỉ dành cho ADMIN)
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 */
router.patch(
  "/:id",
  authenticate,
  authorizeExact("ADMIN"),
  validate(UpdateTermSchema),
  termsController.updateTerm
);

/**
 * @swagger
 * /terms/{id}:
 *   delete:
 *     summary: Xóa kỳ học chưa có lịch học (Chỉ dành cho ADMIN)
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 */
router.delete(
  "/:id",
  authenticate,
  authorizeExact("ADMIN"),
  termsController.deleteTerm
);

export default router;

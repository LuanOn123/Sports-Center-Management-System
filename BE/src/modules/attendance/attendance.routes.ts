import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import * as controller from "./attendance.controller.js";
import { CreateAttendanceSchema, UpdateAttendanceSchema } from "./attendance.schema.js";

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Attendance
 */

/**
 * @swagger
 * /attendance:
 *   get:
 *     tags: [Attendance]
 *     parameters:
 *       - in: query
 *         name: scheduleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "Success" }
 */
router.get("/", controller.getAttendances);

/**
 * @swagger
 * /attendance:
 *   post:
 *     tags: [Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduleId: { type: string }
 *               memberId: { type: string }
 *               status: { type: string, enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"] }
 *     responses:
 *       201: { description: "Success" }
 */
router.post("/", authorize("COACH", "MANAGER"), validate(CreateAttendanceSchema), controller.createAttendance);

/**
 * @swagger
 * /attendance/{id}:
 *   patch:
 *     tags: [Attendance]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"] }
 *     responses:
 *       200: { description: "Success" }
 */
router.patch("/:id", authorize("COACH", "MANAGER"), validate(UpdateAttendanceSchema), controller.updateAttendance);

export default router;
import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import { AiChatSchema } from "./ai.schema.js";
import * as aiController from "./ai.controller.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";

const router = Router();

/**
 * @swagger
 * /ai/chat:
 *   post:
 *     summary: Trò chuyện với Smart Chatbot Assistant
 *     description: |
 *       Gửi tin nhắn cho AI Assistant. AI được tự động nạp ngữ cảnh (RAG) về danh sách gói tập và lịch học 3 ngày tới của trung tâm.
 *       API này là public để khách chưa đăng nhập cũng có thể hỏi thông tin.
 *     tags: [AI Assistant]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *               history:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, model] }
 *                     parts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           text: { type: string }
 *             example:
 *               message: "Trung tâm có gói tập nào và tuần này có lớp Yoga không?"
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "AI responded successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     reply: { type: string, example: "Dạ chào anh/chị, hiện tại bên em có gói Premium giá..." }
 *       500: { $ref: "#/components/responses/ServerError" }
 *       503:
 *         description: AI chưa được cấu hình
 */
router.post("/chat", validate(AiChatSchema), aiController.chat);

/**
 * @swagger
 * /ai/generate-training-plan:
 *   post:
 *     summary: Tạo lịch tập và dinh dưỡng cá nhân hoá bằng AI
 *     description: Dành cho Hội viên (MEMBER). Hệ thống sẽ đọc dữ liệu từ hồ sơ của hội viên (Tuổi, Giới tính, Mục tiêu, Trình độ, Sở thích) để nhờ AI viết lịch tập 7 ngày. Lịch tập sẽ được tạo và lưu luôn vào danh sách Lịch tập của hội viên. Một tài khoản "Trợ Lý AI" sẽ được tự động tạo với vai trò Coach.
 *     tags: [AI Assistant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: Hội viên chưa cập nhật Mục tiêu (fitnessGoal) và Trình độ (trainingLevel) trong hồ sơ.
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post("/generate-training-plan", authenticate, authorize("MEMBER"), aiController.generatePlan);

export default router;

import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import { AiChatSchema } from "./ai.schema.js";
import * as aiController from "./ai.controller.js";

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
 *                     role: { type: string, enum: [user, assistant, system] }
 *                     content: { type: string }
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

export default router;

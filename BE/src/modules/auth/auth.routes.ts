import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { validate } from "../../middlewares/validate.js";
import { avatarUpload } from "../../middlewares/upload.js";
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  UpdateProfileSchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "./auth.schema.js";
import * as authController from "./auth.controller.js";

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new member account
 *     description: |
 *       Tạo tài khoản MEMBER + MemberProfile. **Backend tự động cấp kèm một MembershipSubscription ACTIVE
 *       với gói FREE** (`MembershipPlan.tier = FREE`, `maxConcurrentClasses = 0`) — idempotent, không tạo trùng
 *       nếu member đã có subscription ACTIVE. Vì vậy ngay sau khi đăng ký, `GET /enrollments/my/quota` trả
 *       `hasActiveSubscription = true`, `tier = "FREE"`, `limit = 0`, `used = 0`, `remaining = 0`.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName]
 *             properties:
 *               email: { type: string, format: email, description: "Will be converted to lowercase" }
 *               password: { type: string, minLength: 6 }
 *               fullName: { type: string, maxLength: 100 }
 *               phone: { type: string, pattern: "^[0-9+]{9,15}$", description: "Optional, 9-15 digits, can start with +" }
 *               gender: { type: string, enum: [MALE, FEMALE, OTHER] }
 *               dateOfBirth: { type: string, format: date, description: "Must be in the past" }
 *     responses:
 *       201: { $ref: "#/components/responses/RegisterCreated" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       409: { $ref: "#/components/responses/Conflict" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post("/register", validate(RegisterSchema), authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and receive access + refresh tokens
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, turnstileToken]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               turnstileToken: { type: string, minLength: 1, maxLength: 2048, description: "Single-use Turnstile token with action login" }
 *     responses:
 *       200: { $ref: "#/components/responses/LoginOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       503: { description: "Security verification unavailable or not configured" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post("/login", validate(LoginSchema), authController.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout and revoke refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/MessageOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post("/logout", authenticate, authController.logout);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Get a new access token using a refresh token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/RefreshOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post("/refresh-token", validate(RefreshTokenSchema), authController.refreshToken);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     responses:
 *       200: { $ref: "#/components/responses/ProfileOk" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.get("/me", authenticate, authController.getMe);

/**
 * @swagger
 * /auth/me:
 *   patch:
 *     summary: Update current user profile
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string, maxLength: 100 }
 *               phone: { type: string, pattern: "^[0-9+]{9,15}$", description: "Optional, 9-15 digits, can start with +" }
 *               gender: { type: string, enum: [MALE, FEMALE, OTHER] }
 *               dateOfBirth: { type: string, format: date, description: "Must be in the past" }
 *               fitnessGoal: { type: string }
 *               trainingLevel: { type: string, enum: [BEGINNER, INTERMEDIATE, ADVANCED] }
 *               trainingPreference: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/ProfileOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.patch("/me", authenticate, validate(UpdateProfileSchema), authController.updateMe);

/**
 * @swagger
 * /auth/me/avatar:
 *   post:
 *     summary: Upload avatar image for the current user profile
 *     description: |
 *       Upload ảnh đại diện (chọn từ file) dạng `multipart/form-data`, field name **avatar**.
 *       Chấp nhận jpeg / jpg / png / webp / gif, dung lượng tối đa **5MB**.
 *       Nơi lưu ảnh phụ thuộc env `AVATAR_STORAGE`:
 *       - `local` (mặc định khi chưa có credentials): lưu `uploads/avatars/`, phục vụ tĩnh qua `GET /uploads/avatars/<filename>`;
 *       - `cloudinary` (tự bật khi điền đủ `CLOUDINARY_*`): ảnh resize 512x512, nén q_auto/f_auto,
 *         lưu 1 asset/user nên thay ảnh mới GHI ĐÈ ảnh cũ (không sinh rác).
 *       URL được lưu vào `User.avatarUrl` và trả về trong `GET /auth/me`.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Image file (jpeg, jpg, png, webp, gif), max 5MB
 *     responses:
 *       200: { $ref: "#/components/responses/ProfileOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post("/me/avatar", authenticate, avatarUpload, authController.uploadAvatar);

/**
 * @swagger
 * /auth/me/change-password:
 *   patch:
 *     summary: Change current user password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 6 }
 *     responses:
 *       200: { $ref: "#/components/responses/MessageOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.patch(
  "/me/change-password",
  authenticate,
  validate(ChangePasswordSchema),
  authController.changePassword
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Gửi OTP đặt lại mật khẩu qua email
 *     description: |
 *       Sinh mã OTP 6 chữ số, hợp lệ trong **5 phút**, gửi về địa chỉ email đã đăng ký.
 *       Luôn trả HTTP 200 với cùng thông điệp dù email không tồn tại (chống user enumeration).
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { $ref: "#/components/responses/MessageOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       502:
 *         description: Không gửi được email OTP (tất cả driver mail đều thất bại) — thử lại sau.
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post("/forgot-password", validate(ForgotPasswordSchema), authController.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu bằng OTP nhận qua email
 *     description: |
 *       Xác minh OTP rồi cập nhật mật khẩu mới. OTP chỉ dùng được **một lần** và hết hạn sau 5 phút.
 *       Sau khi thành công, toàn bộ phiên đăng nhập cũ (refresh token) sẽ bị thu hồi.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, minLength: 6, maxLength: 6, description: "Mã 6 chữ số nhận qua email" }
 *               newPassword: { type: string, minLength: 6 }
 *     responses:
 *       200: { $ref: "#/components/responses/MessageOk" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
router.post("/reset-password", validate(ResetPasswordSchema), authController.resetPassword);

export default router;

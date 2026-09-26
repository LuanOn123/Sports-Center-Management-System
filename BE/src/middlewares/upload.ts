import multer from "multer";
import path from "path";
import fs from "fs";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler.js";

const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ── Avatar upload (profile) ────────────────────────────────
// Giữ file trong RAM (<= 5MB) rồi để utils/avatarStorage quyết định đích:
//   - local      => ghi `uploads/avatars/`
//   - cloudinary => đẩy thẳng buffer lên Cloudinary (không ghi disk)
const AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const avatarMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
      cb(new AppError("Avatar must be an image (jpeg, png, webp or gif)", 400));
      return;
    }
    cb(null, true);
  },
});

/**
 * Middleware upload avatar cho profile — multipart/form-data, field name: `avatar`.
 * Bọc `avatarMulter.single` để dịch lỗi Multer (file quá lớn, sai field, ...) thành
 * AppError 400 => errorHandler trả JSON thống nhất thay vì 500.
 */
export function avatarUpload(req: Request, res: Response, next: NextFunction) {
  avatarMulter.single("avatar")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Avatar image must be at most 5MB"
          : `Avatar upload failed: ${err.message}`;
      return next(new AppError(message, 400));
    }
    return next(err as Error);
  });
}

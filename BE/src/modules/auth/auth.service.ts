import { createUser } from "../users/users.service.js";
import { User } from "../../models/User.js";
import { verifyTurnstile } from "./turnstile.service.js";
import { synchronizeUserProjection } from "../users/user-projection.service.js";
import { staffAssignmentView } from "../facilities/staff-assignment-view.js";
import { MemberProfile } from "../../models/MemberProfile.js";
import { CoachProfile } from "../../models/CoachProfile.js";
import { ManagerProfile } from "../../models/ManagerProfile.js";
import { RefreshToken } from "../../models/RefreshToken.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { hashPassword, comparePassword } from "../../utils/bcrypt.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiryDate,
} from "../../utils/jwt.js";
import { hashToken } from "../../utils/hashToken.js";
import { removeStoredAvatar } from "../../utils/avatarStorage.js";
import { createNotification } from "../notifications/notifications.service.js";
import { ensureActiveFreeSubscription } from "../subscriptions/free-subscription.service.js";
import { disconnectUserSockets } from "../chat/chat.socket.js";
import { sendOtpEmail } from "../../utils/mailer.js";
import { randomInt, createHash } from "crypto";
import { prisma } from "../../config/prisma.js";
import type { RegisterInput, UpdateProfileInput, ForgotPasswordInput, ResetPasswordInput } from "./auth.schema.js";

export async function register(data: RegisterInput) {
  const created = await createUser({ ...data, role: "MEMBER" });
  if (!created) throw new AppError("Chưa hoàn tất tạo tài khoản", 503);
  createNotification(created.id, "MEMBER_REGISTERED", "Chào mừng đến với Trung tâm Thể thao!",
    "Tài khoản đã được tạo thành công.").catch(() => {});
  return { id: created.id, email: created.email, fullName: created.fullName, role: created.role, isActive: created.isActive };
}

export async function login(email: string, password: string, turnstileToken: string) {
  await verifyTurnstile(turnstileToken);
  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new AppError("Invalid email or password", 401);
  if (!user.isActive || (user.provisioningStatus && user.provisioningStatus !== "READY")) throw new AppError("Your account has been deactivated", 403);

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new AppError("Invalid email or password", 401);

  const userId = user._id.toString();
  const projection = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, role: true } });
  if (!projection?.isActive || projection.role !== user.role) throw new AppError("Tài khoản chưa hoàn tất đồng bộ.", 503);
  const payload = { id: userId, role: user.role, tokenVersion: user.tokenVersion ?? 0 };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await RefreshToken.create({
    token: hashToken(refreshToken),
    userId,
    expiresAt: getRefreshTokenExpiryDate(),
  });

  // MF-08: tự phục hồi gói FREE nếu đăng ký từng thất bại giữa chừng
  // (user đã tạo nhưng FREE chưa cấp → trước đây hội viên kẹt ở "không có gói tập" tới khi backfill).
  // Idempotent (advisory lock bên trong ensureActiveFreeSubscription) và FAIL-OPEN:
  // lỗi cấp lại FREE không được làm hỏng luồng đăng nhập.
  if (user.role === "MEMBER") {
    try {
      const profile = await prisma.memberProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (profile)
        await prisma.$transaction((tx) => ensureActiveFreeSubscription(tx, profile.id));
    } catch {
      // Bỏ qua — lần đăng nhập sau sẽ thử lại.
    }
  }

  return { accessToken, refreshToken };
}

export async function logout(token: string) {
  const tokenHash = hashToken(token);
  const existing = await RefreshToken.findOne({ token: tokenHash });
  if (!existing) throw new AppError("Refresh token not found", 404);

  await RefreshToken.updateOne(
    { token: tokenHash },
    { revokedAt: new Date() }
  );
}

export async function refreshAccessToken(token: string) {
  let payload: { id: string; role: string; tokenVersion?: number };
  try {
    payload = verifyRefreshToken(token) as { id: string; role: string; tokenVersion?: number };
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const tokenHash = hashToken(token);
  const stored = await RefreshToken.findOne({ token: tokenHash });
  if (!stored) throw new AppError("Refresh token not found", 401);
  if (stored.revokedAt) throw new AppError("Refresh token has been revoked", 401);
  if (stored.expiresAt < new Date()) throw new AppError("Refresh token has expired", 401);

  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw new AppError("User not found or inactive", 401);

  if (payload.role !== user.role || (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0) || (user.provisioningStatus && user.provisioningStatus !== "READY")) throw new AppError("Phiên đăng nhập đã bị thu hồi", 401);
  const accessToken = signAccessToken({ id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion ?? 0 });
  return { accessToken };
}

export async function getMe(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError("User not found", 404);

  const uid = (user._id as any).toString();
  const memberProfile = await MemberProfile.findOne({ userId: uid }).lean();
  const coachProfile = await CoachProfile.findOne({ userId: uid }).lean();
  const managerProfile = await ManagerProfile.findOne({ userId: uid }).lean();

  const transform = (doc: any) => {
    if (!doc) return null;
    return { ...doc, id: doc._id.toString(), _id: undefined, __v: undefined };
  };

  return {
    id: uid,
    ...(await staffAssignmentView(uid, user.role)),
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    memberProfile: transform(memberProfile),
    coachProfile: transform(coachProfile),
    managerProfile: transform(managerProfile),
  };
}

export async function updateMe(userId: string, data: UpdateProfileInput) {
  const { fitnessGoal, trainingLevel, trainingPreference, ...userFields } = data;

  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  // Cập nhật user fields
  if (Object.keys(userFields).length > 0) {
    const updateData: any = { ...userFields };
    if (userFields.dateOfBirth) updateData.dateOfBirth = new Date(userFields.dateOfBirth);
    await User.updateOne({ _id: userId }, updateData);
  }

  // Cập nhật member profile fields
  if (user.role === "MEMBER") {
    const profileData: any = {};
    if (fitnessGoal !== undefined) profileData.fitnessGoal = fitnessGoal;
    if (trainingLevel !== undefined) profileData.trainingLevel = trainingLevel;
    if (trainingPreference !== undefined) profileData.trainingPreference = trainingPreference;
    if (Object.keys(profileData).length > 0) {
      await MemberProfile.updateOne({ userId: user._id.toString() }, profileData);
    }
  }

  await synchronizeUserProjection(userId);
  return getMe(userId);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError("User not found", 404);

  const valid = await comparePassword(currentPassword, user.password);
  if (!valid) throw new AppError("Current password is incorrect", 400);

  const hashed = await hashPassword(newPassword);
  await User.updateOne({ _id: userId }, { password: hashed, $inc: { tokenVersion: 1 } });
  await RefreshToken.deleteMany({ userId: user._id.toString() });

  disconnectUserSockets(userId);
}

export async function updateAvatar(userId: string, avatarUrl: string) {
  const user = await User.findById(userId).select("avatarUrl");
  if (!user) throw new AppError("User not found", 404);

  const oldAvatarUrl = user.avatarUrl ?? null;
  await User.updateOne({ _id: userId }, { avatarUrl });
  await synchronizeUserProjection(userId);
  if (oldAvatarUrl) removeStoredAvatar(oldAvatarUrl);

  return getMe(userId);
}

/** Băm OTP bằng SHA-256 trước khi lưu DB */
function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

export async function forgotPassword(data: ForgotPasswordInput) {
  const OTP_TTL_MS = 5 * 60 * 1000;
  const user = await User.findOne({ email: data.email });
  if (!user || !user.isActive) {
    // Chống user enumeration: luôn trả 200 chung ở controller. Chỉ log để dev biết
    // vì sao không có mail (thường do email sai / account chỉ tồn tại ở PostgreSQL).
    try {
      const pgOnly = await prisma.user.findUnique({ where: { email: data.email } });
      if (pgOnly)
        console.warn(
          `[forgotPassword] ${data.email} tồn tại ở PostgreSQL NHƯNG KHÔNG có trong MongoDB (drift) → không gửi OTP được. Cần đồng bộ lại MongoDB.`
        );
      else
        console.warn(
          `[forgotPassword] Không tìm thấy user hoạt động với email ${data.email} → bỏ qua gửi OTP.`
        );
    } catch {
      console.warn(`[forgotPassword] Không tìm thấy user hoạt động với email ${data.email} → bỏ qua gửi OTP.`);
    }
    return;
  }

  const otp = String(randomInt(100_000, 999_999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const issued = await User.updateOne(
    { _id: user._id, isActive: true, $or: [
      { resetPasswordOtpSentAt: { $lte: new Date(Date.now() - 60_000) } },
      { resetPasswordOtpSentAt: null },
    ] },
    { $set: { resetPasswordOtp: hashOtp(otp), resetPasswordOtpExpiresAt: expiresAt,
      resetPasswordOtpAttempts: 0, resetPasswordOtpSentAt: new Date() } },
  );
  // Same response for unknown accounts and requests during the resend cooldown.
  if (!issued.modifiedCount) return;

  // AWAIT: trước đây lỗi gửi mail bị nuốt (`.catch(console.error)`) nên FE luôn
  // hiển thị "đã gửi" dù email không đi đâu cả. Giờ throw 502 để client báo lỗi thật.
  try {
    await sendOtpEmail(user.email, otp);
  } catch (mailErr) {
    console.error("[forgotPassword] Gửi OTP email thất bại cho", user.email, mailErr);
    throw new AppError(
      "Không gửi được mã OTP qua email. Vui lòng thử lại sau ít phút.",
      502
    );
  }
}

export async function resetPassword(data: ResetPasswordInput) {
  // Reserve an attempt before comparing, including concurrent requests.
  const user = await User.findOneAndUpdate({
    email: data.email, isActive: true,
    resetPasswordOtp: { $ne: null },
    resetPasswordOtpExpiresAt: { $gt: new Date() },
    $or: [{ resetPasswordOtpAttempts: { $lt: 5 } }, { resetPasswordOtpAttempts: { $exists: false } }],
  }, { $inc: { resetPasswordOtpAttempts: 1 } }, { new: true });
  if (!user || !user.isActive) {
    throw new AppError("OTP không hợp lệ hoặc đã hết hạn.", 400);
  }

  if (!user.resetPasswordOtp || !user.resetPasswordOtpExpiresAt) {
    throw new AppError("OTP không hợp lệ hoặc đã hết hạn.", 400);
  }

  if (user.resetPasswordOtpExpiresAt < new Date()) {
    throw new AppError("OTP đã hết hạn. Vui lòng yêu cầu mã mới.", 400);
  }

  const inputHash = hashOtp(data.otp);
  if (inputHash !== user.resetPasswordOtp) {
    throw new AppError("OTP không hợp lệ hoặc đã hết hạn.", 400);
  }

  const hashed = await hashPassword(data.newPassword);
  const userId = user._id.toString();

  const consumed = await User.updateOne(
    { _id: user._id, isActive: true, resetPasswordOtp: inputHash,
      resetPasswordOtpExpiresAt: { $gt: new Date() }, resetPasswordOtpAttempts: { $lte: 5 } },
    { password: hashed, resetPasswordOtp: null, resetPasswordOtpExpiresAt: null, $inc: { tokenVersion: 1 } }
  );
  if (consumed.modifiedCount !== 1) throw new AppError("OTP không hợp lệ hoặc đã hết hạn.", 400);
  await RefreshToken.deleteMany({ userId });

  disconnectUserSockets(userId);
}

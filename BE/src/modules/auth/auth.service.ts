import { User } from "../../models/User.js";
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
import mongoose from "mongoose";
import type { RegisterInput, UpdateProfileInput, ForgotPasswordInput, ResetPasswordInput } from "./auth.schema.js";

export async function register(data: RegisterInput) {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new AppError("Email is already in use", 409);

  const hashed = await hashPassword(data.password);

  // Tạo user + MemberProfile trong MongoDB
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const created = new User({
      email: data.email,
      password: hashed,
      fullName: data.fullName,
      phone: data.phone || null,
      gender: data.gender || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      role: "MEMBER",
    });
    await created.save({ session });
    const userId = created._id.toString();

    const memberProfile = new MemberProfile({ userId });
    await memberProfile.save({ session });

    await session.commitTransaction();

    const memberProfileId = memberProfile._id.toString();

    // DUAL-WRITE: Tạo bản sao trong PostgreSQL để giữ Foreign Key constraint (subscriptions, payments, etc.)
    await prisma.user.create({
      data: {
        id: userId,
        email: created.email,
        password: created.password,
        fullName: created.fullName,
        phone: created.phone,
        gender: created.gender as any,
        dateOfBirth: created.dateOfBirth,
        role: "MEMBER",
      }
    });

    await prisma.memberProfile.create({
      data: {
        id: memberProfileId,
        userId: userId,
      }
    });

    // Tạo FREE subscription trong PostgreSQL (cross-database, ngoài mongo transaction)
    await prisma.$transaction((tx) =>
      ensureActiveFreeSubscription(tx, memberProfileId)
    );

    // Gửi thông báo chào mừng (fire-and-forget)
    createNotification(
      userId,
      "MEMBER_REGISTERED",
      "Chào mừng đến với Trung tâm Thể thao!",
      `Xin chào ${created.fullName}! Tài khoản của bạn đã được tạo thành công. Hãy khám phá các gói tập và lớp học phù hợp với bạn.`
    ).catch(() => {});

    return {
      id: userId,
      email: created.email,
      fullName: created.fullName,
      phone: created.phone,
      gender: created.gender,
      dateOfBirth: created.dateOfBirth,
      role: created.role,
      isActive: created.isActive,
      memberProfile: memberProfile.toJSON(),
    };
  } catch (err) {
    // Lỗi PostgreSQL phía sau commit: không abort được nữa, phải ném lỗi gốc thay vì MongoTransactionError.
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}


export async function login(email: string, password: string) {
  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new AppError("Invalid email or password", 401);
  if (!user.isActive) throw new AppError("Your account has been deactivated", 403);

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new AppError("Invalid email or password", 401);

  const userId = user._id.toString();
  const payload = { id: userId, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await RefreshToken.create({
    token: hashToken(refreshToken),
    userId,
    expiresAt: getRefreshTokenExpiryDate(),
  });

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
  let payload: { id: string; role: string };
  try {
    payload = verifyRefreshToken(token) as { id: string; role: string };
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

  const accessToken = signAccessToken({ id: user._id.toString(), role: user.role });
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
  await User.updateOne({ _id: userId }, { password: hashed });
  await RefreshToken.deleteMany({ userId: user._id.toString() });

  disconnectUserSockets(userId);
}

export async function updateAvatar(userId: string, avatarUrl: string) {
  const user = await User.findById(userId).select("avatarUrl");
  if (!user) throw new AppError("User not found", 404);

  const oldAvatarUrl = user.avatarUrl ?? null;
  await User.updateOne({ _id: userId }, { avatarUrl });
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
  if (!user || !user.isActive) return;

  const otp = String(randomInt(100_000, 999_999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await User.updateOne(
    { _id: user._id },
    { resetPasswordOtp: hashOtp(otp), resetPasswordOtpExpiresAt: expiresAt }
  );

  sendOtpEmail(user.email, otp).catch((mailErr: any) => {
    console.error("[forgotPassword] Failed to send OTP email to", user.email, mailErr);
  });
}

export async function resetPassword(data: ResetPasswordInput) {
  const user = await User.findOne({ email: data.email });
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

  await User.updateOne(
    { _id: user._id },
    { password: hashed, resetPasswordOtp: null, resetPasswordOtpExpiresAt: null }
  );
  await RefreshToken.deleteMany({ userId });

  disconnectUserSockets(userId);
}

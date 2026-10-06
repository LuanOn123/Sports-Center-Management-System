/**
 * Fixture identity cho e2e theo kiến trúc hiện tại: MongoDB giữ identity (login/authenticate
 * đọc `User` từ Mongo), PostgreSQL chỉ là projection. Tạo user thẳng bằng Prisma sẽ không
 * đăng nhập được, và thiếu `connectMongo()` thì mọi query Mongoose bị buffer rồi timeout 10s.
 */
import mongoose from "mongoose";
import { prisma } from "../../src/config/prisma.js";
import { connectMongo } from "../../src/config/mongoose.js";
import { User } from "../../src/models/User.js";
import { MemberProfile } from "../../src/models/MemberProfile.js";
import { CoachProfile } from "../../src/models/CoachProfile.js";
import { ManagerProfile } from "../../src/models/ManagerProfile.js";
import { synchronizeUserProjection } from "../../src/modules/users/user-projection.service.js";

type Role = "ADMIN" | "MANAGER" | "COACH" | "RECEPTIONIST" | "MEMBER";

export async function connectTestMongo(): Promise<void> {
  await connectMongo();
}

export async function disconnectTestMongo(): Promise<void> {
  await mongoose.disconnect();
}

/**
 * Tạo User + profile theo role trong Mongo rồi đồng bộ projection sang PostgreSQL.
 * `password` phải là hash bcrypt (giống fixture cũ). Trả về bản ghi Prisma kèm profile,
 * id user/profile là ObjectId 24-hex như dữ liệu thật.
 */
export async function createIdentity(data: {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}) {
  const user = await User.create(data);
  const userId = user._id.toString();
  if (data.role === "MEMBER") await MemberProfile.create({ userId });
  if (data.role === "COACH") await CoachProfile.create({ userId });
  if (data.role === "MANAGER") await ManagerProfile.create({ userId });
  await synchronizeUserProjection(userId);
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { memberProfile: true, coachProfile: true, managerProfile: true },
  });
}

/** Xoá identity Mongo của fixture (phần PostgreSQL vẫn do cleanup của từng suite xử lý). */
export async function deleteIdentities(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await Promise.all([
    User.deleteMany({ _id: { $in: userIds } }),
    MemberProfile.deleteMany({ userId: { $in: userIds } }),
    CoachProfile.deleteMany({ userId: { $in: userIds } }),
    ManagerProfile.deleteMany({ userId: { $in: userIds } }),
  ]);
}

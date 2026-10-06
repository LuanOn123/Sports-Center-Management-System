import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { MemberProfile } from "../models/MemberProfile.js";
import { CoachProfile } from "../models/CoachProfile.js";
import { ManagerProfile } from "../models/ManagerProfile.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/sports_center";
const SALT = 12;

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB:", MONGO_URI.replace(/\/\/[^@]+@/, "//***@"));
  console.log("Seeding MongoDB...\n");

  const managerPwd = await bcrypt.hash("Manager@123", SALT);
  const staffPwd = await bcrypt.hash("Staff@123", SALT);
  const coachPwd = await bcrypt.hash("Coach@123", SALT);
  const memberPwd = await bcrypt.hash("Member@123", SALT);

  // ─── Helper: upsert user + profile ─────────────────────
  async function upsertUser(
    data: any,
    profileData?: Record<string, any>
  ) {
    let user = await User.findOne({ email: data.email });
    if (!user) {
      user = await User.create(data);
      console.log(`  Created ${data.role}: ${data.email}`);
    } else {
      console.log(`  Exists  ${data.role}: ${data.email}`);
    }

    const userId = user._id.toString();

    if (data.role === "MEMBER") {
      const existing = await MemberProfile.findOne({ userId });
      if (!existing) {
        await MemberProfile.create({ userId, ...profileData });
        console.log(`    → MemberProfile created`);
      }
    } else if (data.role === "COACH") {
      const existing = await CoachProfile.findOne({ userId });
      if (!existing) {
        await CoachProfile.create({ userId, ...profileData });
        console.log(`    → CoachProfile created`);
      }
    } else if (data.role === "MANAGER") {
      const existing = await ManagerProfile.findOne({ userId });
      if (!existing) {
        await ManagerProfile.create({ userId });
        console.log(`    → ManagerProfile created`);
      }
    }

    return user;
  }

  // ─── USERS ───────────────────────────────────────────
  console.log("Creating users...");

  await upsertUser({
    email: "manager@sportscenter.com",
    password: managerPwd,
    fullName: "Center Manager",
    phone: "0900000001",
    role: "MANAGER",
  });

  await upsertUser({
    email: "staff@sportscenter.com",
    password: staffPwd,
    fullName: "Lê Thị Lễ Tân",
    phone: "0900000002",
    role: "RECEPTIONIST",
  });

  await upsertUser(
    {
      email: "coach1@sportscenter.com",
      password: coachPwd,
      fullName: "Nguyễn Văn Cường",
      phone: "0900000003",
      role: "COACH",
    },
    {
      specialization: "Yoga, Pilates",
      experienceYears: 5,
      bio: "Chuyên gia Yoga với 5 năm kinh nghiệm giảng dạy.",
    }
  );

  await upsertUser(
    {
      email: "coach2@sportscenter.com",
      password: coachPwd,
      fullName: "Trần Thị Mai",
      phone: "0900000004",
      role: "COACH",
    },
    {
      specialization: "HIIT, Strength Training",
      experienceYears: 7,
      bio: "HLV HIIT và Strength Training với 7 năm kinh nghiệm.",
    }
  );

  await upsertUser(
    {
      email: "member1@example.com",
      password: memberPwd,
      fullName: "Phạm Văn An",
      phone: "0900000005",
      role: "MEMBER",
    },
    { fitnessGoal: "Giảm cân", trainingLevel: "BEGINNER", trainingPreference: "Buổi sáng" }
  );

  await upsertUser(
    {
      email: "member2@example.com",
      password: memberPwd,
      fullName: "Hoàng Thị Bình",
      phone: "0900000006",
      role: "MEMBER",
    },
    { fitnessGoal: "Tăng cơ", trainingLevel: "INTERMEDIATE", trainingPreference: "Buổi tối" }
  );

  await upsertUser(
    {
      email: "member3@example.com",
      password: memberPwd,
      fullName: "Đỗ Minh Chiến",
      phone: "0900000007",
      role: "MEMBER",
    },
    { fitnessGoal: "Nâng cao thể lực", trainingLevel: "ADVANCED", trainingPreference: "Cuối tuần" }
  );

  await upsertUser(
    {
      email: "sepay.test@example.com",
      password: memberPwd,
      fullName: "SePay Test Member",
      phone: "0900000008",
      role: "MEMBER",
    },
    { fitnessGoal: "Kiểm thử thanh toán VietQR", trainingLevel: "BEGINNER", trainingPreference: "Cuối tuần" }
  );

  console.log("\n✅ MongoDB seeding completed!\n");
  console.log("┌──────────────────────────────────────────────────────────────────┐");
  console.log("│  Test Accounts (MongoDB)                                        │");
  console.log("├──────────────────────────────────────────────────────────────────┤");
  console.log("│  Manager:  manager@sportscenter.com / Manager@123               │");
  console.log("│  Staff:    staff@sportscenter.com   / Staff@123                 │");
  console.log("│  Coach 1:  coach1@sportscenter.com  / Coach@123                 │");
  console.log("│  Coach 2:  coach2@sportscenter.com  / Coach@123                 │");
  console.log("│  Member 1: member1@example.com      / Member@123                │");
  console.log("│  Member 2: member2@example.com      / Member@123                │");
  console.log("│  Member 3: member3@example.com      / Member@123                │");
  console.log("│  SePay:    sepay.test@example.com   / Member@123                │");
  console.log("└──────────────────────────────────────────────────────────────────┘");
  console.log("\n⚠️  LƯU Ý: Sau khi seed MongoDB, bạn cần chạy prisma seed riêng");
  console.log("   để tạo MembershipPlans, Subscriptions, Classes... trong PostgreSQL.");
  console.log("   Và cần update memberProfileId trong PostgreSQL cho khớp với MongoDB.\n");
}

main()
  .catch((e) => {
    console.error("MongoDB seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

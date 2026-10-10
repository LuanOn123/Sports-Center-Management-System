import { z } from "zod";

export const CreateFacilitySchema = z.object({
  code: z.string().min(1, "Facility code is required"),
  name: z.string().min(1, "Facility name is required"),
  address: z.string().min(1, "Address is required"),
  contactInfo: z.string().optional(),
  timezone: z.string().default("Asia/Ho_Chi_Minh"),
});

export const UpdateFacilitySchema = CreateFacilitySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const AssignStaffSchema = z.object({
  userId: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid Mongo user ID"),
  role: z.enum(["MANAGER", "COACH", "RECEPTIONIST"]),
});

export const AssignManagerSchema = z.object({
  userId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  replacedUserId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
});

export const CreateFacilityCoachSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  fullName: z.string().trim().min(1, "Họ tên không được để trống"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").optional(),
  phone: z.string().regex(/^[0-9+\-() ]*$/, "Số điện thoại không hợp lệ").optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().optional(),
  experienceYears: z.number().int().min(0).optional(),
  specialization: z.string().optional(),
  bio: z.string().optional(),
  sportIds: z.array(z.string().trim().min(1)).min(1, "Bắt buộc chọn ít nhất một bộ môn hợp lệ"),
});

export type CreateFacilityCoachInput = z.infer<typeof CreateFacilityCoachSchema>;

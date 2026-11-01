import { z } from "zod";
import { dateOfBirth } from "../../utils/dateOfBirth.js";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phone: z.string().regex(/^[0-9+\-() ]*$/, "Phone must not contain special characters").optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: dateOfBirth.optional(),
  role: z.enum(["MEMBER", "COACH", "RECEPTIONIST", "MANAGER", "ADMIN"]),
  sportIds: z.array(z.string().trim().min(1)).optional(),
  experienceYears: z.number().int().min(0).optional(),
  bio: z.string().optional(),
  fitnessGoal: z.string().optional(),
  trainingLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  trainingPreference: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.role === "COACH" && !data.sportIds?.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sportIds"], message: "Bắt buộc chọn ít nhất một bộ môn giảng dạy." });
});

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().regex(/^[0-9+\-() ]*$/, "Phone must not contain special characters").optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: dateOfBirth.optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["MEMBER", "COACH", "RECEPTIONIST", "MANAGER", "ADMIN"]).optional(),
});

export const UserQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  role: z.enum(["MEMBER", "COACH", "RECEPTIONIST", "MANAGER", "ADMIN"]).optional(),
  isActive: z.string().optional(),
  search: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserQueryInput = z.infer<typeof UserQuerySchema>;

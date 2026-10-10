import { z } from "zod";

export const UpdateMemberSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().regex(/^[0-9+\-() ]*$/, "Phone must not contain special characters").optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().optional(),
  fitnessGoal: z.string().optional(),
  trainingLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  trainingPreference: z.string().optional(),
});

export const MemberQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  trainingLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
});

export const CreateMemberSchema = z.object({
  email: z.string().email("Invalid email address").transform(v => v.toLowerCase().trim()),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100).transform(v => v.trim()),
  phone: z.string()
    .regex(/^[0-9+]{9,15}$/, "Phone must be 9-15 digits")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string()
    .refine(v => !v || !isNaN(Date.parse(v)), "Invalid date of birth")
    .refine(v => !v || new Date(v) <= new Date(), "Date of birth cannot be in the future")
    .optional(),
  fitnessGoal: z.string().max(500).optional(),
  trainingLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  trainingPreference: z.string().max(500).optional(),
});

export type CreateMemberInput = z.infer<typeof CreateMemberSchema>;
export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>;
export type MemberQueryInput = z.infer<typeof MemberQuerySchema>;

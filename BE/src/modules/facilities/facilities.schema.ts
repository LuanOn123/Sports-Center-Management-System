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
  userId: z.string().uuid("Invalid user ID"),
  role: z.enum(["MANAGER", "COACH", "RECEPTIONIST"]),
});

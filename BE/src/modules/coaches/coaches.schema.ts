import { z } from "zod";

export const UpdateCoachSchema = z.object({
  specialization: z.string().min(1).optional(),
  experienceYears: z.number().int().nonnegative().optional(),
  bio: z.string().optional(),
});

export const CoachQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  specialization: z.string().optional(),
});

export type UpdateCoachInput = z.infer<typeof UpdateCoachSchema>;
export type CoachQueryInput = z.infer<typeof CoachQuerySchema>;

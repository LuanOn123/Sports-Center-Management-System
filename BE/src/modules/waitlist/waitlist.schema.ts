import { z } from "zod";

export const JoinWaitlistSchema = z.object({
  scheduleId: z.string().min(1, "scheduleId is required"),
});

export const WaitlistQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  scheduleId: z.string().optional(),
  status: z.enum(["WAITING", "PROMOTED", "CANCELLED"]).optional(),
});

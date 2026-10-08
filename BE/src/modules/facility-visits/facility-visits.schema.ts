import { z } from "zod";

export const CheckInSchema = z.object({
  method: z.enum(["QR", "RECEPTION"]).default("QR"),
});

export const ReceptionCheckInSchema = z.object({
  memberId: z.string().min(1, "memberId is required"),
  method: z.enum(["QR", "RECEPTION"]).default("RECEPTION"),
});

export const VisitQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  memberId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CheckInInput = z.infer<typeof CheckInSchema>;

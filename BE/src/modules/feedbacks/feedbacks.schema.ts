import { z } from "zod";

// CoachProfile.id được đồng bộ từ MongoDB (ObjectId 24-hex); bản ghi legacy
// chưa đồng bộ lại vẫn có thể mang UUID — chấp nhận cả hai.
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const coachIdSchema = z
  .string()
  .refine(
    (v) => OBJECT_ID_RE.test(v) || z.string().uuid().safeParse(v).success,
    "coachId phải là ObjectId hoặc UUID hợp lệ",
  );

export const CreateFeedbackSchema = z.object({
  coachId: coachIdSchema,
  classId: z.string().min(1).optional(),
  rating: z.number().int().min(1, "Đánh giá tối thiểu 1 sao").max(5, "Đánh giá tối đa 5 sao"),
  comment: z.string().max(1000).optional(),
  isAnonymous: z.boolean().optional().default(false),
});

export const UpdateFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
  isAnonymous: z.boolean().optional(),
});

export const FeedbackQuerySchema = z.object({
  coachId: coachIdSchema.optional(),
  classId: z.string().min(1).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>;
export type UpdateFeedbackInput = z.infer<typeof UpdateFeedbackSchema>;
export type FeedbackQueryInput = z.infer<typeof FeedbackQuerySchema>;

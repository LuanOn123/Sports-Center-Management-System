import { z } from "zod";

export const AiChatSchema = z.object({
  message: z.string().trim().min(1, "Tin nhắn không được để trống").max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      })
    )
    .max(12).optional(),
});

export type AiChatInput = z.infer<typeof AiChatSchema>;

import { z } from "zod";

export const AiChatSchema = z.object({
  message: z.string().min(1, "Tin nhắn không được để trống"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .optional(),
});

export type AiChatInput = z.infer<typeof AiChatSchema>;

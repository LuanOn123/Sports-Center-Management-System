import { z } from "zod";

export const AiChatSchema = z.object({
  message: z.string().min(1, "Tin nhắn không được để trống"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        parts: z.array(z.object({ text: z.string() })),
      })
    )
    .optional(),
});

export type AiChatInput = z.infer<typeof AiChatSchema>;

import { api } from "../../shared/api";

export type AIMessage = { role: "user" | "assistant"; content: string };
export async function sendAIMessage(
  message: string,
  history: AIMessage[],
  signal: AbortSignal,
) {
  const response = await api<{ reply: string }>("POST /ai/chat", {
    body: { message, history },
    signal,
  });
  if (typeof response.data?.reply !== "string" || !response.data.reply.trim())
    throw new Error("AI chưa trả về nội dung. Vui lòng thử lại.");
  return response.data.reply;
}

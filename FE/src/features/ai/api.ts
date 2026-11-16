import { api } from "../../shared/api";

export type AIMessage = { role: "user" | "assistant"; content: string };
export async function sendAIMessage(
  message: string,
  history: AIMessage[],
  signal: AbortSignal,
  personal = false,
) {
  const response = await api<{ reply: string }>(personal ? "POST /ai/member-chat" : "POST /ai/chat", {
    body: { message, history: history.slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, 8000) })) },
    signal,
  });
  if (typeof response.data?.reply !== "string" || !response.data.reply.trim())
    throw new Error("AI chưa trả về nội dung. Vui lòng thử lại.");
  return response.data.reply;
}

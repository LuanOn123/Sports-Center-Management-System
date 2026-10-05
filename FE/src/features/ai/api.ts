import { api } from "../../shared/api";

export type AIMessage = { role: "user" | "assistant"; content: string };
<<<<<<< HEAD
=======
export type AIPlan = { id: string; name: string; description: string };
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f
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
<<<<<<< HEAD
=======
export async function generateAIPlan() {
  const response = await api<AIPlan>("POST /ai/generate-training-plan");
  if (typeof response.data?.description !== "string")
    throw new Error(
      "Phản hồi kế hoạch chưa đầy đủ. Hãy kiểm tra danh sách kế hoạch trước khi tạo lại.",
    );
  return response.data;
}
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f

import { AIChatConversation } from "../../features/ai/AIChatBubble";
export function AIAssistantPage() {
  return (
    <section className="ai-page">
      <h1>Trợ lý AI</h1>
      <AIChatConversation personal />
    </section>
  );
}

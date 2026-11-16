import { AIChatConversation } from "../../features/ai/AIChatBubble";
export function AIAssistantPage() {
  return (
    <section className="panel">
      <h1>Trợ Lý Sports Center</h1>
      <h1>Trợ lý AI</h1>
      <AIChatConversation personal />
    </section>
  );
}

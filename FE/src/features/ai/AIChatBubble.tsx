import { useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { Modal } from "../../shared/ui";
import { AIMarkdown } from "./AIMarkdown";
import { sendAIMessage, type AIMessage } from "./api";

export function AIChatConversation({
  initialHistory = [],
  onHistoryChange,
}: {
  initialHistory?: AIMessage[];
  onHistoryChange?: (history: AIMessage[]) => void;
}) {
  const [history, setHistory] = useState<AIMessage[]>(initialHistory);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [history, pending, error]);
  async function send() {
    const message = input.trim();
    if (!message || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setPending(message);
    setInput("");
    setError("");
    try {
      const reply = await sendAIMessage(message, history, request.signal);
      if (!request.signal.aborted) {
        const next: AIMessage[] = [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: reply },
        ];
        setHistory(next);
        onHistoryChange?.(next);
      }
    } catch (e) {
      if (!request.signal.aborted) {
        setError(e instanceof Error ? e.message : "Không thể gửi tin nhắn.");
        setInput(message);
      }
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setPending("");
    }
  }
  return (
    <div className="ai-chat">
      <div
        className="ai-chat-messages"
        role="log"
        aria-label="Cuộc trò chuyện với AI"
        aria-live="polite"
      >
        <div className="ai-message">
          <AIMarkdown>
            Chào bạn, mình là Trợ lý Sports Center. Mình có thể giúp gì cho bạn?
          </AIMarkdown>
        </div>
        {history.map((message, index) => (
          <div
            key={index}
            className={`ai-message ${message.role === "user" ? "ai-message-user" : ""}`}
          >
            {message.role === "assistant" ? (
              <AIMarkdown>{message.content}</AIMarkdown>
            ) : (
              message.content
            )}
          </div>
        ))}
        {pending && (
          <>
            <div className="ai-message ai-message-user">{pending}</div>
            <p role="status">AI đang gõ...</p>
          </>
        )}
        <div ref={bottom} />
      </div>
      {error && (
        <p role="alert" className="error-state">
          {error} Bạn có thể gửi lại câu hỏi bên dưới.
        </p>
      )}
      <form
        className="ai-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="ai-input-label">
          Câu hỏi cho AI
          <input
            autoFocus
            value={input}
            disabled={Boolean(pending)}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Nhập câu hỏi..."
          />
        </label>
        <button
          className="button primary"
          disabled={Boolean(pending) || !input.trim()}
          type="submit"
        >
          <Send size={18} /> Gửi
        </button>
      </form>
    </div>
  );
}

export function AIChatBubble() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<AIMessage[]>([]);
  return (
    <>
      <button
        className="ai-fab"
        aria-label="Mở trợ lý AI"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Bot size={24} />
      </button>
      {open && (
        <Modal
          title="Trợ Lý Sports Center"
          eyebrow="PULSE / AI ASSISTANT"
          maxWidth={520}
          onClose={() => setOpen(false)}
        >
          <AIChatConversation
            initialHistory={history}
            onHistoryChange={setHistory}
          />
        </Modal>
      )}
    </>
  );
}

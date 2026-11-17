import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, Bot, LoaderCircle, Send } from "lucide-react";
import { Modal } from "../../shared/ui";
import { AIMarkdown } from "./AIMarkdown";
import { sendAIMessage, type AIMessage } from "./api";

export function AIChatConversation({
  initialHistory = [],
  onHistoryChange,
  personal = false,
  compact = false,
}: {
  initialHistory?: AIMessage[];
  onHistoryChange?: (history: AIMessage[]) => void;
  personal?: boolean;
  compact?: boolean;
}) {
  const [history, setHistory] = useState<AIMessage[]>(initialHistory);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const messages = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const viewport = messages.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [history, pending, error]);
  const suggestions = personal
    ? [
        "Lịch tập sắp tới của tôi?",
        "Tiến độ khóa học của tôi?",
        "Tôi có giáo án nào?",
      ]
    : [
        "Trung tâm có những lớp nào?",
        "Các gói tập hiện có?",
        "Tìm cơ sở gần tôi",
      ];
  async function send() {
    const message = input.trim();
    if (!message || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setPending(message);
    setInput("");
    setError("");
    try {
      const reply = await sendAIMessage(
        message,
        history,
        request.signal,
        personal,
      );
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
    <div className={`ai-chat${compact ? " ai-chat-compact" : ""}`}>
      <div
        className="ai-chat-messages"
        ref={messages}
        role="log"
        aria-label="Cuộc trò chuyện với AI"
        aria-live="polite"
      >
        {history.length === 0 && !pending && (
          <div className="ai-welcome">
            <span className="ai-avatar">
              <Bot size={25} aria-hidden="true" />
            </span>
            <h2>Bạn muốn tìm hiểu gì?</h2>
            <p>
              {personal
                ? "Hỏi về lịch tập, tiến độ hoặc giáo án của bạn."
                : "Hỏi về lớp học, cơ sở hoặc gói tập tại Pulse."}
            </p>
            <div className="ai-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    composer.current?.focus();
                  }}
                >
                  {suggestion}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((message, index) => (
          <div
            key={index}
            className={`ai-message-row${message.role === "user" ? " ai-message-row-user" : ""}`}
          >
            {message.role === "assistant" && (
              <span className="ai-avatar">
                <Bot size={17} aria-hidden="true" />
              </span>
            )}
            <div
              className={`ai-message${message.role === "user" ? " ai-message-user" : ""}`}
            >
              {message.role === "assistant" ? (
                <AIMarkdown>{message.content}</AIMarkdown>
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}
        {pending && (
          <>
            <div className="ai-message-row ai-message-row-user">
              <div className="ai-message ai-message-user">{pending}</div>
            </div>
            <p className="ai-pending" role="status">
              <LoaderCircle
                className="ai-spinner"
                size={16}
                aria-hidden="true"
              />{" "}
              Đang soạn câu trả lời…
            </p>
          </>
        )}
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
          <textarea
            ref={composer}
            autoFocus={compact}
            rows={1}
            maxLength={2000}
            value={input}
            disabled={Boolean(pending)}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Nhập câu hỏi…"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </label>
        <button
          className="button primary"
          disabled={Boolean(pending) || !input.trim()}
          type="submit"
        >
          <Send size={18} aria-hidden="true" /> Gửi
        </button>
      </form>
    </div>
  );
}

export function AIChatBubble({
  launcher,
  personal = false,
}: {
  launcher?: (launch: () => void) => ReactNode;
  personal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<AIMessage[]>([]);
  return (
    <>
      {launcher ? (
        launcher(() => setOpen(true))
      ) : (
        <button
          className="ai-fab"
          aria-label="Mở trợ lý AI"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Bot size={24} />
        </button>
      )}
      {open && (
        <Modal
          title="Trợ Lý Sports Center"
          eyebrow="PULSE / AI ASSISTANT"
          maxWidth={600}
          onClose={() => setOpen(false)}
        >
          <AIChatConversation
            compact
            personal={personal}
            initialHistory={history}
            onHistoryChange={setHistory}
          />
        </Modal>
      )}
    </>
  );
}

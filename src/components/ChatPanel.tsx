import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

export function ChatPanel() {
  const chatOpen = useAppStore((s) => s.chatOpen);
  const setChatOpen = useAppStore((s) => s.setChatOpen);
  const chatMessages = useAppStore((s) => s.chatMessages);
  const sendChatMessage = useAppStore((s) => s.sendChatMessage);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatOpen) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [chatOpen]);

  return (
    <aside
      className="chat-panel"
      id="chat-panel"
      aria-label="Assistant chat"
      aria-hidden={!chatOpen}
    >
      <div className="chat-panel-header">
        <span className="chat-panel-title">Assistant</span>
        <button
          type="button"
          className="chat-panel-close"
          aria-label="Close assistant"
          onClick={() => setChatOpen(false)}
        >
          ×
        </button>
      </div>
      <div
        className="chat-messages"
        role="log"
        aria-live="polite"
      >
        {chatMessages.length === 0 && (
          <p className="chat-empty-hint">
            Ask a question about your notes. Connect an AI backend later to get
            real replies.
          </p>
        )}
        {chatMessages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="chat-composer">
        <textarea
          ref={inputRef}
          className="chat-input"
          rows={2}
          placeholder="Message…"
          aria-label="Chat message"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const text = inputRef.current?.value.trim() ?? "";
              if (text) {
                sendChatMessage(text);
                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }
            }
          }}
        />
        <button
          type="button"
          className="chat-send btn btn-primary"
          onClick={() => {
            const text = inputRef.current?.value.trim() ?? "";
            if (text) {
              sendChatMessage(text);
              if (inputRef.current) {
                inputRef.current.value = "";
              }
            }
          }}
        >
          Send
        </button>
      </div>
    </aside>
  );
}

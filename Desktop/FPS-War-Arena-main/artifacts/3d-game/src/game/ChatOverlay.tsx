import { useState, useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { filterBadWords, hasBadWords } from "./badwords";

interface ChatMessage {
  from: string;
  username: string;
  text: string;
  isFounder: boolean;
  isSystem: boolean;
  isRadio?: boolean;
  radioColor?: string;
  timestamp: number;
}

interface ChatOverlayProps {
  socket: Socket;
  username: string;
  isFounder: boolean;
  roomId: string | null;
  onFocusChange: (focused: boolean) => void;
  onBadWord?: (text: string) => void;
}

export default function ChatOverlay({ socket, username, isFounder, roomId, onFocusChange, onBadWord }: ChatOverlayProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg]);
      setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      }, 30);
    };
    socket.on("chat_message", handler);
    return () => { socket.off("chat_message", handler); };
  }, [socket]);

  const openChat = useCallback(() => {
    setActive(true);
    onFocusChange(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [onFocusChange]);

  const closeChat = useCallback(() => {
    setActive(false);
    onFocusChange(false);
    inputRef.current?.blur();
  }, [onFocusChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" && !active) { e.preventDefault(); openChat(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, openChat]);

  const sendMessage = useCallback(() => {
    const raw = input.trim();
    if (!raw) { closeChat(); return; }
    if (hasBadWords(raw)) onBadWord?.(raw);
    const filtered = filterBadWords(raw);
    socket.emit("chat_message", { text: filtered, roomId });
    setInput("");
    closeChat();
  }, [input, socket, roomId, closeChat, onBadWord]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); sendMessage(); }
    if (e.key === "Escape") { setInput(""); closeChat(); }
  };

  return (
    <div className="chat-overlay" style={{ opacity: active || messages.length > 0 ? 1 : 0.4 }}>
      <div className="chat-messages" ref={listRef}>
        {messages.map((msg, i) => {
          if (msg.isRadio) {
            return (
              <div key={i} className="chat-msg chat-msg-radio" style={{ borderLeftColor: msg.radioColor }}>
                <span className="chat-radio-name" style={{ color: msg.radioColor }}>{msg.username}</span>
                <span className="chat-colon">: </span>
                <span className="chat-radio-text" style={{ color: msg.radioColor }}>{msg.text}</span>
              </div>
            );
          }
          return (
            <div
              key={i}
              className={["chat-msg", msg.isSystem ? "chat-msg-system" : "", msg.isFounder ? "chat-msg-founder" : ""].join(" ")}
            >
              {msg.isSystem ? (
                <span className="chat-system-text">{msg.text}</span>
              ) : (
                <>
                  <span className={msg.isFounder ? "chat-founder-name" : "chat-name"}>
                    {msg.isFounder && <span className="founder-shield">🛡️ </span>}
                    {msg.isFounder ? msg.username.toUpperCase() : msg.username}
                    {msg.isFounder && <span className="founder-badge"> KURUCU</span>}
                  </span>
                  <span className="chat-colon">: </span>
                  <span className="chat-text">{msg.text}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      {active && (
        <div className="chat-input-row">
          <input
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mesaj yaz... (Enter = gönder, Esc = kapat)"
            maxLength={200}
            autoComplete="off"
          />
        </div>
      )}
      {!active && <div className="chat-hint"><span className="key-badge">Enter</span> Chat</div>}
    </div>
  );
}

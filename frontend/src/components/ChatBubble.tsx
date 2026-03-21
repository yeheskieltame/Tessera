"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
  model?: string;
}

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi, I'm Tessera. Ask me anything about public goods evaluation, Octant data, or how to use the analysis tools." },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", text: data.reply, model: data.model }]);
      } else if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${data.error}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Failed to connect to the server." }]);
    }

    setLoading(false);
  }

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-8rem)] rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <img src="/tessera-icon-64.png" alt="" className="w-5 h-5" />
              <span className="text-sm font-bold text-white">Tessera Agent</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-lg leading-none">&times;</button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-sm"
                    : "bg-white/[0.06] text-white/90 border border-white/5 rounded-bl-sm"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.model && (
                    <p className="text-[9px] text-white/30 mt-1 font-mono">{msg.model}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/5 rounded-bl-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/10 bg-white/[0.02]">
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Octant, funding analysis..."
                className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-3 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
            <p className="text-[9px] text-white/20 mt-1.5 text-center">
              API: POST /api/chat {"{"}&quot;message&quot;: &quot;...&quot;{"}"}
            </p>
          </div>
        </div>
      )}

      {/* Floating Bubble Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl shadow-blue-500/30 flex items-center justify-center transition-all duration-300 ${
          open
            ? "bg-white/10 backdrop-blur-xl border border-white/20 rotate-0"
            : "bg-blue-500 hover:bg-blue-400 hover:scale-110"
        }`}
      >
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
    </>
  );
}

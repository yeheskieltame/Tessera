"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
  model?: string;
  command?: string;
  reportPath?: string;
}

/* Simple markdown-like rendering: **bold**, `code`, \n */
function FormatText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;

        // Table row detection (contains |)
        const isTableRow = line.includes("|") && line.trim().startsWith("|") || (line.split("|").length >= 3 && !line.startsWith("-"));
        const isSeparator = /^[\s|:-]+$/.test(line);

        if (isSeparator) return null;

        if (isTableRow) {
          const cells = line.split("|").map(c => c.trim()).filter(Boolean);
          return (
            <div key={i} className="flex gap-2 text-[11px] font-mono py-0.5 border-b border-white/5">
              {cells.map((cell, j) => (
                <span key={j} className={`flex-1 ${j === 0 ? "text-white/90 font-semibold" : "text-white/70"} truncate`}>{cell}</span>
              ))}
            </div>
          );
        }

        // Process inline formatting
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <p key={i} className="text-[13px] leading-relaxed">
            {parts.map((part, j) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={j} className="font-bold text-white">{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith("`") && part.endsWith("`")) {
                return <code key={j} className="px-1 py-0.5 rounded bg-white/10 text-blue-300 text-[11px] font-mono">{part.slice(1, -1)}</code>;
              }
              return <span key={j}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi, I'm Tessera Agent. I analyze Octant public goods projects across 9 data sources with signal reliability scoring.\n\nClick a quick action below or ask me anything:\n**\"analyze epoch 5\"** - K-means clustering + whale detection\n**\"trust graph epoch 5\"** - Donor diversity + coordination risk\n**\"collect signals rotki\"** - Cross-source signals + Discourse\n**\"evaluate project\"** - 8-dimension AI scoring + PDF" },
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
        setMessages((prev) => [...prev, {
          role: "assistant",
          text: data.reply,
          model: data.model,
          command: data.command,
          reportPath: data.reportPath,
        }]);
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
        <div className="fixed bottom-24 right-3 sm:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[460px] max-w-[460px] h-[70vh] sm:h-[600px] max-h-[calc(100vh-8rem)] rounded-2xl border border-white/10 bg-[#0b0f1a]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-[chatOpen_0.3s_ease-out]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src="/tessera-icon-64.png" alt="" className="w-7 h-7" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0b0f1a]" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block leading-tight">Tessera Agent</span>
                <span className="text-[10px] text-emerald-400">Online</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mt-0.5">
                    <img src="/tessera-icon-64.png" alt="" className="w-4 h-4" />
                  </div>
                )}

                {/* Bubble */}
                <div className={`max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-blue-500 rounded-2xl rounded-br-md px-4 py-2.5"
                    : "bg-white/[0.04] border border-white/[0.08] rounded-2xl rounded-bl-md px-4 py-3"
                }`}>
                  {msg.command && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] font-mono text-emerald-300">executed: {msg.command}</span>
                    </div>
                  )}

                  <div className={msg.role === "user" ? "text-white text-[13px]" : "text-white/85"}>
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <FormatText text={msg.text} />
                    )}
                  </div>

                  {msg.reportPath && (
                    <div className="mt-2.5 pt-2 border-t border-white/5">
                      <a
                        href={`/api/reports/${msg.reportPath.split("/").pop()}`}
                        download
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-300 text-xs font-semibold hover:bg-blue-500/25 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download PDF Report
                      </a>
                    </div>
                  )}
                  {msg.model && msg.model !== "none" && !msg.reportPath && (
                    <div className="mt-2 pt-1.5 border-t border-white/5">
                      <span className="text-[9px] text-white/30 font-mono">{msg.model}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <img src="/tessera-icon-64.png" alt="" className="w-4 h-4 animate-pulse" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/[0.08]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick actions — auto-send on click */}
          {messages.length <= 1 && !loading && (
            <div className="px-4 pb-2">
              <p className="text-[10px] text-white/30 mb-1.5 font-semibold uppercase tracking-wider">Quick Actions</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Epoch 5 Analysis", cmd: "analyze epoch 5" },
                  { label: "Whale Detection", cmd: "detect anomalies epoch 5" },
                  { label: "Trust Graph", cmd: "trust graph epoch 5" },
                  { label: "Simulate 4 QF", cmd: "simulate mechanisms epoch 5" },
                  { label: "Collect Signals: Rotki", cmd: "collect signals rotki" },
                  { label: "Scan Chain 0x3250c2", cmd: "scan chain 0x3250c2CEE20FA34D1c4F68eAA87E53512e95A62a" },
                ].map(({ label, cmd }) => (
                  <button
                    key={cmd}
                    onClick={() => { setInput(cmd); setTimeout(() => { setInput(""); setMessages(prev => [...prev, { role: "user", text: cmd }]); setLoading(true); fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: cmd }) }).then(r => r.json()).then(data => { if (data.reply) setMessages(prev => [...prev, { role: "assistant", text: data.reply, model: data.model, command: data.command, reportPath: data.reportPath }]); else if (data.error) setMessages(prev => [...prev, { role: "assistant", text: `Error: ${data.error}` }]); setLoading(false); }).catch(() => { setMessages(prev => [...prev, { role: "assistant", text: "Connection failed." }]); setLoading(false); }); }, 50); }}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/60 hover:text-white hover:bg-white/[0.08] hover:border-blue-500/30 transition"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/10">
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Octant, funding analysis..."
                className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/40 transition"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center hover:bg-blue-400 disabled:opacity-20 disabled:cursor-not-allowed transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>
            <p className="text-[9px] text-white/20 mt-2 text-center font-mono">
              API: POST /api/chat
            </p>
          </div>
        </div>
      )}

      {/* Floating Bubble */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 group"
      >
        <div className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
          open
            ? "bg-white/10 backdrop-blur-xl border border-white/20 scale-90"
            : "bg-[#0b0f1a] border-2 border-blue-500/40 hover:border-blue-400/60 hover:scale-110 shadow-2xl shadow-blue-500/20"
        }`}>
          <img src="/tessera-icon-64.png" alt="Chat" className={`w-8 h-8 transition-all duration-300 ${open ? "opacity-50 scale-90" : "opacity-100"}`} />

          {/* Chat indicator dots */}
          {!open && (
            <div className="absolute -top-1 -right-1 flex items-center gap-[2px] px-1.5 py-1 rounded-full bg-blue-500 shadow-lg shadow-blue-500/40">
              <div className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "200ms" }} />
              <div className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "400ms" }} />
            </div>
          )}

          {/* Close X when open */}
          {open && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>

        {/* Pulse ring */}
        {!open && (
          <div className="absolute inset-0 w-16 h-16 rounded-full border border-blue-500/20 animate-ping" style={{ animationDuration: "3s" }} />
        )}
      </button>

      <style jsx global>{`
        @keyframes chatOpen {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

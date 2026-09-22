"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, ChevronDown, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { Spinner } from "@/components/ui";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: Array<{ label: string; href: string }>;
};

const SUGGESTED_QUESTIONS = [
  "What are the Kitchen / NVZ rules?",
  "How do daily games & slots work?",
  "Which paddle should I buy?",
  "Explain DUPR ratings & levels",
  "Where are the courts in Kolkata?",
];

export function AIChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Ask about rules, court bookings, paddles, tournaments or your account.",
      actions: [
        { label: "Book a slot", href: "/games" },
        { label: "Shop paddles", href: "/products" },
        { label: "Tournaments", href: "/tournaments" },
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  async function sendMessage(textToSend?: string) {
    const text = (textToSend ?? input).trim();
    if (!text || busy) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: data.reply ?? "I can assist you with that! Check out the quick links below.",
        actions: data.actions ?? [],
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error("[ai/chat] send error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: "assistant",
          content:
            "I could not reach the server. The venue team is on WhatsApp at +91 91631 32551.",
          actions: [{ label: "Chat on WhatsApp", href: "https://wa.me/919163132551" }],
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <aside aria-label="SuperPro AI Assistant" className="fixed bottom-5 left-5 z-40 print:hidden">
      {/* Floating Toggle Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex items-center gap-2.5 rounded-full border-2 border-volt bg-ink px-4 py-3 shadow-[0_12px_32px_rgba(6,38,61,0.28)] transition-all hover:scale-105 hover:bg-[#07304e] active:scale-95"
          aria-label="Open SuperPro AI Chatbot"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-volt" />
          </span>
          <Bot size={20} className="text-volt" />
          <span className="text-xs font-bold tracking-wide text-paper">Ask AI Caddy</span>
        </button>
      )}

      {/* Expanded Chat Drawer / Popover */}
      {open && (
        <div className="animate-pop-in flex flex-col w-[360px] sm:w-[420px] max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-100px)] rounded-2xl border border-line bg-paper shadow-[0_24px_64px_rgba(6,38,61,0.35)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-ink px-4 py-3.5 text-paper">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-volt text-ink font-bold">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-paper flex items-center gap-1.5">
                  SuperPro AI Caddy
                  <span className="h-2 w-2 rounded-full bg-volt inline-block" />
                </p>
                <p className="font-mono text-[10px] text-paper/60 uppercase tracking-wider">Enterprise Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setMessages([
                    {
                      id: "welcome-reset",
                      role: "assistant",
                      content: "Chat cleared. What else can I help you with?",
                      actions: [
                        { label: "Daily Games", href: "/games" },
                        { label: "Paddle Shop", href: "/products" },
                      ],
                    },
                  ])
                }
                className="rounded-md px-2 py-1 text-[11px] text-paper/60 hover:bg-paper/10 hover:text-paper transition-colors"
                title="Clear conversation"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-paper/70 transition-colors hover:bg-paper/10 hover:text-paper"
                aria-label="Close Chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-mist/20 text-ink">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-ink text-paper rounded-br-none shadow-sm"
                      : "bg-paper border border-line text-ink rounded-bl-none shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-line">{m.content}</p>
                </div>

                {/* Suggested Action Buttons */}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[90%]">
                    {m.actions.map((act) => (
                      <Link
                        key={act.href}
                        href={act.href}
                        onClick={() => setOpen(false)}
                        className="btn-volt btn-sm text-[10px] py-0.5 px-2.5 font-semibold inline-flex items-center gap-1 shadow-sm"
                      >
                        {act.label} →
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-ink/50 py-1">
                <Spinner />
                <span>Thinking &amp; searching SuperPro knowledge…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Carousel */}
          <div className="border-t border-line bg-paper px-3 py-2">
            <p className="font-mono text-[9px] uppercase tracking-wider text-ink/45 mb-1.5">Quick Questions</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  disabled={busy}
                  className="shrink-0 rounded-full border border-line bg-mist/50 px-2.5 py-1 text-[11px] font-medium text-ink/75 transition-colors hover:border-ink/40 hover:bg-mist hover:text-ink"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-line bg-paper p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about rules, slots, paddles, DUPR…"
                className="field text-xs py-2 px-3 flex-1"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="btn-volt btn-sm p-2 shrink-0 disabled:opacity-40"
                aria-label="Send message"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}

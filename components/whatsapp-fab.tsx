"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { waLink, WHATSAPP_GROUP_URL, WHATSAPP_NUMBER } from "@/lib/site";

const QUICK_ASKS = [
  { label: "Which paddle suits me?", msg: "Hi SuperPro! I'd like help picking a paddle." },
  { label: "Book today's game", msg: "Hi SuperPro! I want to book a slot for today's game." },
  { label: "Coaching enquiry", msg: "Hi SuperPro! I'd like to know more about coaching sessions." },
  { label: "Order / delivery status", msg: "Hi SuperPro! I have a question about my order." },
];

/**
 * Floating "talk to a representative" launcher. Every entry is a wa.me deep
 * link with the message pre-filled, so the rep opens a chat that already says
 * what the customer needs.
 */
export function WhatsAppFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div className="w-[280px] origin-bottom-right animate-wipe-in rounded-card border border-line bg-paper p-5 shadow-lift">
          <p className="font-display text-xl text-ink">Talk to a rep</p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink/60">
            A real person, usually within a few minutes.
          </p>
          <div className="mt-4 flex flex-col gap-1.5">
            {QUICK_ASKS.map((q) => (
              <a
                key={q.label}
                href={waLink(q.msg)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5 text-[13px] font-medium text-ink/80 transition-colors hover:border-ink hover:text-ink"
              >
                {q.label}
                <span aria-hidden className="text-ink/25 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </a>
            ))}
          </div>
          {WHATSAPP_GROUP_URL && (
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded-lg bg-volt-soft px-3 py-2.5 text-center text-[13px] font-semibold text-volt-deep transition-colors hover:bg-volt/25"
            >
              Join the games group
            </a>
          )}
          <p className="mt-3 text-center font-mono text-[11px] tabular-nums text-ink/40">+{WHATSAPP_NUMBER}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close WhatsApp menu" : "Chat with a SuperPro representative"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-paper shadow-lift transition-[transform,background-color] duration-200 ease-out hover:bg-ink-700 active:translate-y-px"
      >
        {open ? <X size={23} /> : <MessageCircle size={25} />}
      </button>
    </div>
  );
}

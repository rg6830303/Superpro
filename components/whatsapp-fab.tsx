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
        <div className="w-72 origin-bottom-right animate-fade-up rounded-2xl border border-white/10 bg-ink-800 p-4 shadow-card">
          <p className="font-display text-lg uppercase text-bone">Talk to a rep</p>
          <p className="mt-1 text-xs text-bone/55">
            Real person, usually replies in a few minutes. Pick what you need:
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {QUICK_ASKS.map((q) => (
              <a
                key={q.label}
                href={waLink(q.msg)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-bone/80 transition-colors hover:border-gold/50 hover:text-gold"
              >
                {q.label}
              </a>
            ))}
          </div>
          {WHATSAPP_GROUP_URL && (
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded-lg bg-volt/10 px-3 py-2 text-center text-xs font-semibold text-volt"
            >
              Join the daily games group
            </a>
          )}
          <p className="mt-3 text-center text-[11px] text-bone/35">+{WHATSAPP_NUMBER}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close WhatsApp menu" : "Chat with a SuperPro representative"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-ink shadow-lift transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X size={24} /> : <MessageCircle size={26} />}
      </button>
    </div>
  );
}

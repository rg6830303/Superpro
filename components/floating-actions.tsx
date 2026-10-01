"use client";

import { usePathname } from "next/navigation";
import { AIChatbot } from "@/components/ai-chatbot";
import { WhatsAppFab } from "@/components/whatsapp-fab";

/**
 * The two floating launchers — the AI caddy and WhatsApp — minus the pages
 * where they only get in the way: sign-in and sign-up, where they sat over the
 * "Already have an account?" link on a phone; checkout, where nothing should
 * compete with the pay button; and the coach portal, which is a work tool.
 */
const QUIET = ["/login", "/signup", "/checkout", "/coach"];

/** On the main (launch) domain only WhatsApp stays: the AI caddy talks bookings and gear that are not open yet. */
export function FloatingActions({ hideChatbot = false }: { hideChatbot?: boolean }) {
  const pathname = usePathname();
  if (QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return (
    <>
      <WhatsAppFab />
      {!hideChatbot && <AIChatbot />}
    </>
  );
}

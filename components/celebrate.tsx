"use client";

import { Check } from "lucide-react";
import { Confetti } from "@/components/motion";

/**
 * Confirmation mark for server-rendered success pages. Keeps the celebration
 * in one client island so the page around it stays a server component.
 */
export function CelebrationMark() {
  return (
    <div className="relative">
      <Confetti trigger={1} />
      <div className="mx-auto flex h-16 w-16 animate-score-pop items-center justify-center rounded-full bg-volt text-ink">
        <Check size={30} strokeWidth={3} />
      </div>
    </div>
  );
}

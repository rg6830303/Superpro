"use client";

import { usePathname } from "next/navigation";

/**
 * Route transition for the console. Deliberately quicker and quieter than the
 * public site's — staff move between these pages dozens of times an hour, and
 * an animation that reads as characterful on a first visit becomes friction on
 * the fortieth. A fade, not a slide: moving the whole page on a navigation
 * repaints every pixel of it and, while it runs, re-parents any fixed child
 * onto the transformed wrapper.
 */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  );
}

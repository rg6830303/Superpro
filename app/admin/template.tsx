"use client";

import { usePathname } from "next/navigation";

/**
 * Route transition for the console. Deliberately quicker and quieter than the
 * public site's — staff move between these pages dozens of times an hour, and
 * an animation that reads as characterful on a first visit becomes friction on
 * the fortieth.
 */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-wipe-in">
      {children}
    </div>
  );
}

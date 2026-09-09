"use client";

import { usePathname } from "next/navigation";

/**
 * Route transition. A template (not a layout) remounts on every navigation,
 * which is what lets the CSS animation replay — keying on the pathname makes
 * that explicit rather than incidental. The animation itself lives in
 * globals.css so it stays in step with the rest of the motion system, and it
 * collapses to nothing under prefers-reduced-motion.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-shell">
      {children}
    </div>
  );
}

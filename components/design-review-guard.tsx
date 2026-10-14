"use client";

import { useEffect } from "react";

/** The localhost-only visual fixture must never submit real account changes. */
export function DesignReviewGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method !== "GET" && method !== "HEAD") {
        return Response.json({ error: "This is a read-only design preview. No account, payment, or booking was changed." }, { status: 409 });
      }
      return original(input, init);
    };
    return () => { window.fetch = original; };
  }, []);
  return children;
}

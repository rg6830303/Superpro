"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A console tab that lives in the URL (?tab=…).
 *
 * Tabs used to be plain component state, so the browser's Back button skipped
 * every tab the admin had opened and landed on the previous page — usually
 * the dashboard. Each tab change now adds a history entry: Back and Forward
 * step through tabs, a refresh keeps the tab, and a tab can be linked to.
 */
export function useUrlTab<T extends string>(fallback: T, allowed: readonly T[]): [T, (tab: T) => void] {
  const read = useCallback((): T => {
    if (typeof window === "undefined") return fallback;
    const v = new URLSearchParams(window.location.search).get("tab") as T | null;
    return v && allowed.includes(v) ? v : fallback;
    // allowed is a constant list per page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback]);

  const [tab, setTabState] = useState<T>(fallback);

  useEffect(() => {
    setTabState(read());
    const onPop = () => setTabState(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [read]);

  const setTab = useCallback(
    (next: T) => {
      setTabState(next);
      const url = new URL(window.location.href);
      if (next === fallback) url.searchParams.delete("tab");
      else url.searchParams.set("tab", next);
      if (url.href !== window.location.href) window.history.pushState(window.history.state, "", url.pathname + url.search + url.hash);
    },
    [fallback],
  );

  return [tab, setTab];
}

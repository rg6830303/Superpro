"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, BellOff } from "lucide-react";

const PREF = "sparvic:browser-notify";
const SEEN = "sparvic:notified-ids";
const EVENT = "sparvic:notify-pref";
const POLL_MS = 45_000;

type Note = { id: string; title: string; message: string; link_url: string | null; read?: boolean };

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};
const supported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
const unread = (n: Note) => !n.read;

async function registration() {
  return navigator.serviceWorker.register("/sw-notify.js").then(() => navigator.serviceWorker.ready);
}

async function show(n: Note) {
  const reg = await registration();
  await reg.showNotification(n.title, {
    body: n.message,
    icon: "/logo/sparvic-logo-on-white.png",
    badge: "/logo/sparvic-logo-on-white.png",
    tag: n.id,
    data: { url: n.link_url || "/dashboard/activity" },
  });
}

/**
 * Polls the player's notifications while the site is open (any tab, even in
 * the background) and raises a browser notification for each new unread one,
 * once. Also reports the unread count so the shell can badge the bell.
 */
export function BrowserNotifier({ onUnread }: { onUnread?: (n: number) => void }) {
  const busy = useRef(false);
  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch("/api/player/notifications?limit=10", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: Note[]; unreadCount: number };
      onUnread?.(data.unreadCount ?? 0);
      if (!supported() || store.get(PREF) !== "on" || Notification.permission !== "granted") return;
      const seen = new Set<string>(JSON.parse(store.get(SEEN) ?? "[]"));
      const fresh = (data.notifications ?? []).filter((n) => unread(n) && !seen.has(n.id));
      for (const n of fresh.slice(0, 3).reverse()) await show(n).catch(() => {});
      fresh.forEach((n) => seen.add(n.id));
      store.set(SEEN, JSON.stringify([...seen].slice(-80)));
    } catch {
      /* offline or signed out: try again next tick */
    } finally {
      busy.current = false;
    }
  }, [onUnread]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(EVENT, poll);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); window.removeEventListener(EVENT, poll); };
  }, [poll]);
  return null;
}

/** On/off switch for browser notifications, shown on the Activity page. */
export function BrowserNotifyToggle() {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "blocked">("off");
  useEffect(() => {
    if (!supported()) return setState("unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    setState(store.get(PREF) === "on" && Notification.permission === "granted" ? "on" : "off");
  }, []);

  async function turnOn() {
    const p = await Notification.requestPermission();
    if (p !== "granted") return setState(p === "denied" ? "blocked" : "off");
    // Everything already in the feed counts as seen; only new alerts pop up.
    const res = await fetch("/api/player/notifications?limit=40").catch(() => null);
    const data = res?.ok ? await res.json() : { notifications: [] };
    store.set(SEEN, JSON.stringify((data.notifications as Note[]).map((n) => n.id)));
    store.set(PREF, "on");
    setState("on");
    await show({ id: "welcome", title: "Notifications are on", message: "We’ll let you know about follows, bookings and club news.", link_url: "/dashboard/activity" }).catch(() => {});
    window.dispatchEvent(new Event(EVENT));
  }
  function turnOff() {
    store.set(PREF, "off");
    setState("off");
  }

  if (state === "unsupported") return null;
  return (
    <div className="demo-notify-card card flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-volt/40 text-ink">
          {state === "on" ? <BellRing size={18} /> : <BellOff size={18} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Browser notifications</p>
          <p className="text-xs text-ink/60">
            {state === "on"
              ? "On for this browser. New follows, bookings and club news pop up here."
              : state === "blocked"
                ? "Blocked in your browser settings. Allow notifications for this site to turn them on."
                : "Get a pop-up for new follows, bookings and club news."}
          </p>
        </div>
      </div>
      {state === "on" ? (
        <button type="button" onClick={turnOff} className="btn-outline btn-sm">Turn off</button>
      ) : state === "off" ? (
        <button type="button" onClick={turnOn} className="btn-volt btn-sm">Turn on</button>
      ) : null}
    </div>
  );
}

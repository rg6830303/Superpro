"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Calendar, CheckCheck, Compass, Sparkles, Trophy, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/player-directory";
import { Spinner } from "@/components/ui";
import type { UserNotification } from "@/lib/notifications";

export function ActivityFeed({
  initialNotifications = [],
  initialUnreadCount = 0,
}: {
  initialNotifications?: UserNotification[];
  initialUnreadCount?: number;
}) {
  const [notifications, setNotifications] = useState<UserNotification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/player/notifications?limit=40");
      const data = await res.json();
      if (res.ok && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (err) {
      console.error("[activity-feed] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setMarking(true);
    try {
      await fetch("/api/player/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("[activity-feed] mark read failed:", err);
    } finally {
      setMarking(false);
    }
  }

  const iconFor = (kind: string) => {
    switch (kind) {
      case "game_booking":
        return <Calendar size={16} className="text-volt-deep" />;
      case "tournament_entry":
        return <Trophy size={16} className="text-amber-500" />;
      case "follow":
        return <UserPlus size={16} className="text-blue-500" />;
      default:
        return <Sparkles size={16} className="text-volt-deep" />;
    }
  };

  const actionLabelFor = (kind: string) => {
    switch (kind) {
      case "game_booking":
        return "Book a slot";
      case "tournament_entry":
        return "View tournament";
      case "follow":
        return "View profile";
      default:
        return "Check out";
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-volt-deep" />
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Activity</p>
            </div>
            <h2 className="mt-1 text-2xl font-bold text-ink">From players you follow</h2>
            <p className="mt-1 text-sm text-ink/65">
              When someone you follow books a game or enters a tournament, it shows up here — and so do new followers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={marking}
                className="btn-outline btn-sm inline-flex items-center gap-1.5 text-xs font-semibold"
              >
                {marking ? <Spinner /> : <CheckCheck size={14} />}
                <span>Mark all read ({unreadCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={fetchNotifications}
              disabled={loading}
              className="chip cursor-pointer text-xs hover:border-ink/40"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card py-16 text-center">
          <Users size={36} className="mx-auto text-ink/30" />
          <p className="mt-4 text-base font-semibold text-ink">No activity yet</p>
          <p className="mt-1 max-w-sm mx-auto text-xs text-ink/55">
            Follow a few players from the Community tab and their games and tournament entries will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`card flex items-start gap-4 p-5 transition-all ${
                !item.read ? "border-l-4 border-l-volt bg-mist/20" : "hover:border-line-strong"
              }`}
            >
              <div className="relative shrink-0 mt-0.5">
                <Avatar
                  name={item.actor_name || "Sparvic"}
                  src={item.actor_avatar}
                  size="sm"
                />
                <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-line bg-paper shadow-sm">
                  {iconFor(item.kind)}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{item.title}</p>
                  <span className="font-mono text-[11px] text-ink/45">
                    {new Date(item.created_at).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink/75">{item.message}</p>

                {item.link_url && (
                  <div className="mt-3">
                    <Link
                      href={item.link_url}
                      className="btn-volt btn-sm inline-flex items-center gap-1 text-[11px] py-1 px-3"
                    >
                      {actionLabelFor(item.kind)} →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

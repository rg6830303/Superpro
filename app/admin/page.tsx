"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { Spinner } from "@/components/ui";
import { formatRupees } from "@/lib/money";
import { CalendarDays, Package, GraduationCap, Trophy, MessageSquare, RefreshCw } from "lucide-react";

type StatsData = {
  revenue?: { orders_paise: number; games_paise: number; coaching_paise: number };
  today?: { slots: number; players: number };
  pipeline?: { new_orders: number; coaching_requests: number; tournament_pending: number; players: number };
  outbox?: { queued: number; failed: number };
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadStats() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to load stats", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  const totalPaise =
    (stats?.revenue?.orders_paise ?? 0) +
    (stats?.revenue?.games_paise ?? 0) +
    (stats?.revenue?.coaching_paise ?? 0);

  return (
    <div>
      <AdminHeader
        title="Admin Overview"
        sub="Live stats, registrations and platform operations"
        action={
          <button onClick={loadStats} disabled={loading} className="btn-outline btn-sm gap-2">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh Data
          </button>
        }
      />

      {loading && !stats ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total Revenue" value={formatRupees(totalPaise)} tone="accent" hint="Paid orders & games" />
            <StatTile label="Today's Players" value={stats?.today?.players ?? 0} hint={`${stats?.today?.slots ?? 0} open slots`} />
            <StatTile label="New Orders" value={stats?.pipeline?.new_orders ?? 0} tone={stats?.pipeline?.new_orders ? "warn" : "default"} hint="Awaiting fulfillment" />
            <StatTile label="Registered Players" value={stats?.pipeline?.players ?? 0} hint="User accounts" />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4 text-volt-deep">
                <CalendarDays size={20} />
                <h2 className="text-xl font-bold">Daily Games</h2>
              </div>
              <p className="text-sm text-ink/70 mb-4">Manage court sessions, venues, and player registrations.</p>
              <Link href="/admin/games" className="btn-outline btn-sm w-full">Manage Games</Link>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4 text-volt-deep">
                <Package size={20} />
                <h2 className="text-xl font-bold">Store & Orders</h2>
              </div>
              <p className="text-sm text-ink/70 mb-4">Process equipment orders, stock levels, and paddle inventory.</p>
              <div className="flex gap-2">
                <Link href="/admin/orders" className="btn-outline btn-sm flex-1">Orders</Link>
                <Link href="/admin/products" className="btn-outline btn-sm flex-1">Products</Link>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4 text-volt-deep">
                <GraduationCap size={20} />
                <h2 className="text-xl font-bold">Coaching & Pros</h2>
              </div>
              <p className="text-sm text-ink/70 mb-4">View certified coaches and client session booking requests.</p>
              <Link href="/admin/coaching" className="btn-outline btn-sm w-full">Manage Coaching</Link>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4 text-volt-deep">
                <Trophy size={20} />
                <h2 className="text-xl font-bold">Tournaments</h2>
              </div>
              <p className="text-sm text-ink/70 mb-4">Organize Kolkata Series, category draws, and team entries.</p>
              <Link href="/admin/tournaments" className="btn-outline btn-sm w-full">Manage Tournaments</Link>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4 text-volt-deep">
                <MessageSquare size={20} />
                <h2 className="text-xl font-bold">WhatsApp Outbox</h2>
              </div>
              <p className="text-sm text-ink/70 mb-4">
                {stats?.outbox?.queued ?? 0} queued notifications, {stats?.outbox?.failed ?? 0} failed.
              </p>
              <Link href="/admin/whatsapp" className="btn-outline btn-sm w-full">WhatsApp Hub</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

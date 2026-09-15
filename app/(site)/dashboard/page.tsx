import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/auth";
import { getUserRow } from "@/lib/accounts";
import { listWalletTransactions, reconcilePendingTopups } from "@/lib/wallet";
import { isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { ageFrom } from "@/lib/profile";
import { listUserNotifications, getUnreadNotificationCount } from "@/lib/notifications";
import {
  DashboardView,
  type GameRow,
  type CoachRow,
  type EntryRow,
  type OrderRow,
  type TabKey,
} from "@/components/dashboard-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await getPlayerSession();
  if (!session) redirect("/login?next=/dashboard");

  await ensureSchema();
  await reconcilePendingTopups(session.id).catch(() => {});

  const { tab } = (await searchParams) ?? {};
  const validTabs: TabKey[] = ["overview", "discover", "activity", "profile", "wallet"];
  const validTab = validTabs.includes(tab as TabKey) ? (tab as TabKey) : "overview";

  const [games, coaching, entries, orders] = await Promise.all([
    query<GameRow>(
      `SELECT r.id, s.session_date::text AS session_date, s.start_time, v.name AS venue_name,
              COALESCE(r.court_number, s.court_number) AS court_number,
              r.status, r.payment_status, r.amount_paise
       FROM game_registrations r
       JOIN game_sessions s ON s.id = r.session_id
       JOIN venues v ON v.id = s.venue_id
       WHERE r.user_id = $1
       ORDER BY s.session_date DESC, s.start_time DESC LIMIT 20`,
      [session.id],
    ).catch(() => []),
    query<CoachRow>(
      `SELECT b.booking_no, c.name AS coach_name, b.preferred_date, b.preferred_time,
              b.sessions_count, b.status, b.amount_paise
       FROM coaching_bookings b JOIN coaches c ON c.id = b.coach_id
       WHERE b.user_id = $1 ORDER BY b.created_at DESC LIMIT 10`,
      [session.id],
    ).catch(() => []),
    query<EntryRow>(
      `SELECT r.reference, t.title AS tournament_title, t.slug AS tournament_slug,
              t.starts_on::text AS starts_on, r.category, r.team_name, r.status,
              r.payment_status, r.amount_paise,
              g.name AS group_name
       FROM tournament_registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       LEFT JOIN tournament_groups g ON g.id = r.group_id
       WHERE r.user_id = $1
       ORDER BY t.starts_on DESC LIMIT 10`,
      [session.id],
    ).catch(() => []),
    query<OrderRow>(
      `SELECT order_no, total_paise, fulfillment_status, payment_status, created_at
       FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [session.id],
    ).catch(() => []),
  ]);

  const [profile, walletTx, notifications, unreadCount] = await Promise.all([
    getUserRow(session.id),
    listWalletTransactions(session.id, 25),
    listUserNotifications(session.id, 30),
    getUnreadNotificationCount(session.id),
  ]);

  return (
    <DashboardView
      session={session}
      profile={{
        email: profile?.email ?? session.email,
        handle: profile?.handle ?? null,
        avatar_url: profile?.avatar_url ?? null,
        bio: profile?.bio ?? null,
        date_of_birth: profile?.date_of_birth ?? null,
        age: profile?.date_of_birth ? ageFrom(profile.date_of_birth) : null,
        gender: profile?.gender ?? null,
        full_name: profile?.full_name ?? session.name,
        phone: profile?.phone ?? "",
        skill_level: profile?.skill_level ?? "beginner",
        city: profile?.city ?? "Kolkata",
        dupr: profile?.dupr ?? null,
        dupr_id: profile?.dupr_id ?? null,
        whatsapp_opt_in: profile?.whatsapp_opt_in ?? true,
        wallet_balance_paise: Number(profile?.wallet_balance_paise ?? 0),
      }}
      initialTab={validTab}
      walletTx={walletTx}
      games={games}
      coaching={coaching}
      entries={entries}
      orders={orders}
      notifications={notifications}
      unreadCount={unreadCount}
      razorpayEnabled={isRazorpayEnabled}
      razorpayKeyId={razorpayKeyId}
    />
  );
}

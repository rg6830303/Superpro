import { PAIRING_ENABLED } from "@/lib/sparvic-open";
import { getLeaderboard } from "@/lib/leaderboard";
import { listUserBadges } from "@/lib/badges-server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/auth";
import { getUserRow } from "@/lib/accounts";
import { listWalletTransactions, reconcilePendingTopups } from "@/lib/wallet";
import { isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { headers } from "next/headers";
import { surfaceOfHost } from "@/lib/surface";
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

export async function renderDashboard(tab: TabKey) {
  const session = await getPlayerSession();
  if (!session) redirect(`/login?next=${tab === "overview" ? "/dashboard" : `/dashboard/${tab}`}`);

  await ensureSchema();
  await reconcilePendingTopups(session.id).catch(() => {});

  const validTab = tab;

  const [games, coaching, entries, orders] = await Promise.all([
    query<GameRow>(
      `SELECT r.id, s.session_date::text AS session_date, s.start_time, s.end_time, v.name AS venue_name,
              COALESCE(r.court_number, s.court_number) AS court_number,
              r.status, r.payment_status, r.amount_paise, s.level, s.mixed_doubles,
              ((s.session_date + s.start_time::time) AT TIME ZONE 'Asia/Kolkata') <= now() AS started,
              EXTRACT(EPOCH FROM (((s.session_date + s.start_time::time) AT TIME ZONE 'Asia/Kolkata') - now())) / 3600 AS hours_to_start,
              CASE WHEN r.status = 'waitlist' THEN (SELECT COUNT(*) FROM game_registrations w
                WHERE w.session_id = r.session_id AND w.status = 'waitlist' AND w.created_at <= r.created_at)::int END AS waitlist_position
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
      // The last event is what the account shows: the admin moving an order on
      // is the only thing that changes here after checkout, so surface it.
      `SELECT o.order_no, o.total_paise, o.fulfillment_status, o.payment_status, o.created_at,
              o.courier, o.tracking_ref,
              (SELECT e.note FROM order_events e WHERE e.order_id = o.id ORDER BY e.created_at DESC LIMIT 1)
                AS last_note,
              (SELECT e.created_at::text FROM order_events e WHERE e.order_id = o.id ORDER BY e.created_at DESC LIMIT 1)
                AS last_update
       FROM orders o WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT 10`,
      [session.id],
    ).catch(() => []),
  ]);

  const launch = surfaceOfHost((await headers()).get("host")) === "main";
  const following = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM follows WHERE follower_id = $1`,
    [session.id],
  ).catch(() => [{ n: 0 }]);
  const followers = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM follows WHERE following_id = $1`,
    [session.id],
  ).catch(() => [{ n: 0 }]);
  const partnerRequests = !PAIRING_ENABLED ? 0 : await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM open_pairs WHERE partner_id = $1 AND status = 'pending'`,
    [session.id],
  ).then((r) => r[0]?.n ?? 0).catch(() => 0);
  const standings = tab === "rankings" || tab === "profile" || tab === "overview" ? await getLeaderboard(session.id) : [];

  const [profile, walletTx, notifications, unreadCount, badges] = await Promise.all([
    getUserRow(session.id),
    listWalletTransactions(session.id, 25),
    listUserNotifications(session.id, 30),
    getUnreadNotificationCount(session.id),
    listUserBadges(session.id),
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
      launch={launch}
      followingCount={following[0]?.n ?? 0}
      followersCount={followers[0]?.n ?? 0}
      standings={standings}
      partnerRequests={partnerRequests}
      badges={badges}
    />
  );
}

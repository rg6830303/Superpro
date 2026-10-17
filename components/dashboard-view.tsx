"use client";

import { SparvicOpenMini } from "@/components/sparvic-open-mini";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  X,
  Bell,
  Check,
  CalendarDays,
  Compass,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  Medal,
  MapPin,
  Package,
  Trophy,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { BadgeChip } from "@/components/badge-chip";
import { LiveLeaderboard } from "@/components/live-leaderboard";
import { BrowserNotifyToggle } from "@/components/browser-notifier";
import type { UserBadge } from "@/lib/badges";
import { EmptyState } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { GameBookings, type GameBooking } from "@/components/game-bookings";
import { WalletTopUp } from "@/components/wallet-topup";
import { Avatar } from "@/components/player-directory";
import { PlayerDirectory } from "@/components/player-directory";
import { ActivityFeed } from "@/components/activity-feed";
import { formatDate, formatTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { WALLET_FLOOR_PAISE, duesPaise, isBlocked } from "@/lib/postpaid";
import { ageFrom } from "@/lib/profile";
import { LEVEL_LABEL } from "@/lib/levels";
import type { WalletTransaction } from "@/lib/wallet";
import type { UserNotification } from "@/lib/notifications";

export type GameRow = GameBooking;

export type CoachRow = {
  booking_no: string;
  coach_name: string;
  preferred_date: string | null;
  preferred_time: string | null;
  sessions_count: number;
  status: string;
  amount_paise: number;
};

export type EntryRow = {
  reference: string;
  tournament_title: string;
  tournament_slug: string;
  starts_on: string;
  category: string | null;
  team_name: string;
  status: string;
  payment_status: string;
  amount_paise: number;
  group_name: string | null;
  /** Where the row links; defaults to the tournament page. */
  href?: string;
};

/** The player's Sparvic Open standing, shown on the clubhouse home. */
export type OpenStatus = {
  confirmed: Array<{ reference: string; label: string }>;
  pendingRefs: string[];
  more: string[];
};

/** The same words the admin console and the order page use, so nobody has to translate. */
const ORDER_STATUS: Record<string, string> = {
  new: "Placed",
  confirmed: "Confirmed",
  packed: "Confirmed",
  dispatched: "Out for delivery",
  shipped: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export type OrderRow = {
  order_no: string;
  total_paise: number;
  fulfillment_status: string;
  payment_status: string;
  created_at: string;
  courier: string | null;
  tracking_ref: string | null;
  last_note: string | null;
  last_update: string | null;
};

export type PlayerProfileData = {
  email: string;
  handle: string | null;
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  age?: number | null;
  gender: string | null;
  full_name: string;
  phone: string;
  skill_level: string;
  city: string;
  dupr: number | null;
  dupr_id: string | null;
  whatsapp_opt_in: boolean;
  wallet_balance_paise: number;
};

export { DASHBOARD_TABS, TAB_TITLES, tabHref, type TabKey, type RankRow } from "@/lib/dashboard-tabs";
import { tabHref, type TabKey, type RankRow } from "@/lib/dashboard-tabs";

const TAB_META: Array<{ key: TabKey; label: string; icon: typeof LayoutDashboard; member?: boolean }> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "bookings", label: "Bookings", icon: CalendarDays, member: true },
  { key: "community", label: "Community", icon: Compass },
  { key: "rankings", label: "Rankings", icon: Medal },
  { key: "activity", label: "Activity", icon: Bell },
  { key: "wallet", label: "Wallet", icon: Wallet, member: true },
  { key: "profile", label: "Profile", icon: UserCog },
];

export function DashboardView({
  session,
  profile,
  initialTab = "overview",
  walletTx,
  games,
  coaching,
  entries,
  orders,
  notifications = [],
  unreadCount = 0,
  razorpayEnabled,
  razorpayKeyId,
  launch = false,
  followingCount = 0,
  followersCount = 0,
  standings = [],
  badges = [],
  partnerRequests = 0,
  openStatus,
}: {
  session: { id: string; name: string; email: string };
  profile: PlayerProfileData;
  initialTab?: TabKey;
  walletTx: WalletTransaction[];
  games: GameRow[];
  coaching: CoachRow[];
  entries: EntryRow[];
  orders: OrderRow[];
  notifications?: UserNotification[];
  unreadCount?: number;
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  /** Main domain during the launch: profile + community only, no bookings or wallet. */
  launch?: boolean;
  followingCount?: number;
  followersCount?: number;
  standings?: RankRow[];
  badges?: UserBadge[];
  partnerRequests?: number;
  openStatus?: OpenStatus;
}) {
  const router = useRouter();
  const tabs = TAB_META.filter((t) => !(launch && t.member));
  const activeTab: TabKey = tabs.some((t) => t.key === initialTab) ? initialTab : "overview";
  const switchTab = (tab: TabKey) => router.push(tabHref(tab));

  const upcomingGames = games.filter((g) => g.status === "confirmed" && !g.started);
  const nextGame = [...upcomingGames].sort((a, b) => Number(a.hours_to_start) - Number(b.hours_to_start))[0];
  const walletPaise = Number(profile?.wallet_balance_paise ?? 0);
  // Postpaid: the balance can legitimately be negative, and when it is, the
  // number on screen is a debt rather than a balance. Colour and wording follow
  // that, because a red minus sign alone is easy to misread as credit.
  const owing = duesPaise(walletPaise);
  const walletBlocked = isBlocked(walletPaise);
  const walletTone = owing > 0 ? "text-signal" : "text-volt-deep";
  const calculatedAge = profile.age ?? ageFrom(profile.date_of_birth);
  const name = profile.full_name || session.name;
  const me = standings.find((r) => r.id === session.id);

  return (
    <div className="wrap section demo-dashboard">
      {partnerRequests > 0 && (
        <Link href="/dashboard/sparvic-open" className="so-banner">
          <span className="so-banner-dot" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <strong>{partnerRequests} doubles partner request{partnerRequests === 1 ? "" : "s"}</strong> for the Sparvic Open. Review and accept in the tournament tab.
          </span>
          <ArrowRight size={16} />
        </Link>
      )}
      {/* The demo clubhouse switches sections from its sidebar and bottom tab bar;
          the main domain has no clubhouse shell, so it keeps tabs here. */}
      {launch && (
        <nav className="demo-account-tabs" aria-label="Your account">
          {tabs.map(({ key, label, icon: Icon }) => (
            <Link key={key} href={tabHref(key)} aria-current={activeTab === key ? "page" : undefined}>
              <Icon size={15} />
              <span>{label}</span>
              {key === "activity" && unreadCount > 0 && <span className="demo-badge-inline">{unreadCount}</span>}
            </Link>
          ))}
        </nav>
      )}

      {activeTab === "overview" && launch && (
        <LaunchOverview profile={profile} followingCount={followingCount} switchTab={switchTab} />
      )}

      {activeTab === "overview" && !launch && (
        <div className="space-y-8">
          <div className="demo-overview-head">
            <p className="eyebrow">Your clubhouse<SparvicOpenMini href="/dashboard/tournaments" /></p>
            <h1>Hi {name.split(" ")[0]}, ready to play?</h1>
          </div>
          <div className="demo-account-metrics grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { icon: CalendarDays, k: `${upcomingGames.length}`, v: "Upcoming games" },
              { icon: GraduationCap, k: `${coaching.length}`, v: "Coaching" },
              { icon: Trophy, k: `${entries.length}`, v: "Tournaments" },
              { icon: Package, k: `${orders.length}`, v: "Orders" },
            ].map((s) => (
              <Link key={s.v} href={tabHref("bookings")} className="card card-hover p-4 sm:p-5">
                <s.icon size={17} className="text-volt-deep" />
                <p className="mt-3 font-display text-3xl text-ink sm:text-4xl">{s.k}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">{s.v}</p>
              </Link>
            ))}
          </div>

          {openStatus && <OpenCard s={openStatus} />}

          <section className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Notifications</p>
              <Link href={tabHref("activity")} className="text-xs font-semibold text-volt-deep hover:underline">
                See all{unreadCount > 0 ? ` (${unreadCount} new)` : ""}
              </Link>
            </div>
            {notifications.length === 0 ? (
              <p className="mt-3 text-sm text-ink/55">Nothing yet. Follows, bookings and club news show up here.</p>
            ) : (
              <ul className="demo-note-list">
                {notifications.slice(0, 4).map((n) => (
                  <li key={n.id} className={n.read ? undefined : "is-new"}>
                    <Link href={n.link_url || tabHref("activity")}>
                      <span className="demo-note-dot" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{n.title}</span>
                        <span className="block truncate text-xs text-ink/60">{n.message}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-ink/45">{new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid min-w-0 gap-5 lg:grid-cols-[1.4fr_1fr]">
            <section className="card p-6">
              <p className="eyebrow">Next on court</p>
              {nextGame ? (
                <>
                  <h2 className="mt-2 text-2xl">
                    {formatDate(nextGame.session_date)} · {formatTime(nextGame.start_time)}
                  </h2>
                  <p className="mt-1 text-sm text-ink/65">
                    {nextGame.venue_name}
                    {nextGame.court_number ? ` · Court ${nextGame.court_number}` : ""}
                  </p>
                  <Link href={tabHref("bookings")} className="btn-outline btn-sm mt-5">
                    All my bookings <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-2xl">Nothing booked yet</h2>
                  <p className="mt-1 text-sm text-ink/65">Pick a slot this week; your court number lands on WhatsApp.</p>
                  <Link href="/dashboard/play" className="btn-volt btn-sm mt-5">
                    Find a game <ArrowRight size={14} />
                  </Link>
                </>
              )}
            </section>

            <section className="card flex flex-col p-6">
              <p className="eyebrow">Sparvic wallet</p>
              <p className={`mt-2 font-display text-4xl ${walletTone}`}>{formatPaise(walletPaise)}</p>
              {owing > 0 && (
                <p className="mt-1 text-[11px] font-semibold text-signal">
                  {formatPaise(owing)} owed{walletBlocked ? " — bookings paused" : ""}
                </p>
              )}
              <Link href={tabHref("wallet")} className="btn-outline btn-sm mt-auto pt-0">
                <Wallet size={13} /> Top up &amp; history
              </Link>
            </section>
          </div>

          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <section className="card p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">Leaderboard</p>
                <Link href={tabHref("rankings")} className="text-xs font-semibold text-volt-deep hover:underline">
                  Full leaderboard
                </Link>
              </div>
              <LiveLeaderboard initialRows={standings} meId={session.id} limit={5} variant="full" />
            </section>
            <section className="card flex flex-col p-6">
              <p className="eyebrow">Your people</p>
              <h2 className="mt-2 text-2xl">
                {followersCount} followers · {followingCount} following
              </h2>
              <p className="mt-1 text-sm text-ink/65">
                Follow the players you rally with and hear when they book a game or enter a tournament.
              </p>
              <Link href={tabHref("community")} className="btn-volt btn-sm mt-5 self-start">
                <Users size={14} /> Discover players
              </Link>
            </section>
          </div>
        </div>
      )}

      {activeTab === "bookings" && (
        <BookingsSection games={games} coaching={coaching} entries={entries} orders={orders} />
      )}

      {activeTab === "community" && (
        <div className="mt-8">
          <PlayerDirectory initial={[]} signedIn fixedView="all" />
        </div>
      )}

      {activeTab === "rankings" && (
        <div className="mt-8 space-y-6">
          <SectionHead eyebrow="Leaderboard" title="Club leaderboard" sub="Live: ordered by DUPR rating, then games played, and refreshed every few seconds. Add your DUPR in your profile to climb." />
          {me && (
            <div className="demo-rank-me card p-5">
              <div>
                <p className="demo-stat-label">Your position</p>
                <p className="demo-stat-value">#{me.rank} <small>of {standings.length}</small></p>
              </div>
              <div>
                <p className="demo-stat-label">Games played</p>
                <p className="demo-stat-value">{me.games}</p>
              </div>
              <div>
                <p className="demo-stat-label">Followers</p>
                <p className="demo-stat-value">{me.followers}</p>
              </div>
              {me.dupr == null && (
                <Link href={tabHref("profile")} className="btn-volt btn-sm">
                  Add your DUPR
                </Link>
              )}
            </div>
          )}
          <section className="card p-4 sm:p-6">
            <LiveLeaderboard initialRows={standings} meId={session.id} limit={500} />
          </section>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="mt-8 max-w-3xl">
          <SectionHead eyebrow="Activity" title="What’s new" sub="Follows, bookings and club updates." />
          <div className="mb-6"><BrowserNotifyToggle /></div>
          <ActivityFeed initialNotifications={notifications} initialUnreadCount={unreadCount} />
        </div>
      )}

      {activeTab === "profile" && (
        <div className="mt-8 max-w-3xl space-y-8">
          <SectionHead
            eyebrow="Player profile"
            title="View & edit profile"
            sub="Your photo, age, sex and DUPR level decide your tournament brackets and match eligibility."
          />
          <PlayerCard profile={profile} name={name} age={calculatedAge} badges={badges} rank={me?.rank ?? null} followersCount={followersCount} followingCount={followingCount} unreadCount={unreadCount} variant="profile" />
          <ProfileForm profile={profile} hideWallet={true} />
        </div>
      )}

      {activeTab === "wallet" && (
        <div className="mt-8 max-w-3xl space-y-8">
          <SectionHead
            eyebrow="Sparvic wallet"
            title="Credit & top up"
            sub="Prepaid balance for instant checkout on games, coaching, tournaments and the shop."
          />
          <div className="demo-wallet-card card p-6">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
              <Wallet size={13} className="text-volt-deep" /> Current balance
            </p>
            <p className={`mt-1 font-display text-5xl ${walletTone}`}>{formatPaise(walletPaise)}</p>
            {owing > 0 ? (
              <p className={`mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${walletBlocked ? "bg-signal/10 text-signal" : "bg-mist text-ink/70"}`}>
                {walletBlocked ? (
                  <>
                    You have reached the {formatPaise(Math.abs(WALLET_FLOOR_PAISE))} postpaid limit. Clear{" "}
                    {formatPaise(owing)} to book daily games again.
                  </>
                ) : (
                  <>
                    Running on postpaid credit. You can go up to {formatPaise(Math.abs(WALLET_FLOOR_PAISE))} before
                    bookings pause.
                  </>
                )}
              </p>
            ) : null}
            <div className="mt-6 pt-5">
              <h3 className="mb-3 text-lg font-semibold text-ink">Load wallet credit</h3>
              <WalletTopUp
                razorpayEnabled={razorpayEnabled}
                razorpayKeyId={razorpayKeyId}
                name={profile.full_name}
                email={profile.email}
                phone={profile.phone}
              />
            </div>
          </div>
          <div className="card p-6">
            <h3 className="text-2xl">Wallet history</h3>
            {walletTx.length === 0 ? (
              <p className="mt-3 text-sm text-ink/55">
                No wallet movements yet. Top up online or ask a rep to load credit at the venue.
              </p>
            ) : (
              <div className="table-wrap mt-5">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Note</th>
                      <th>Amount</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletTx.map((t) => (
                      <tr key={t.id}>
                        <td>{new Date(t.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                        <td className="capitalize">{t.kind}</td>
                        <td className="text-ink/70">{t.reason ?? "—"}</td>
                        <td className={t.delta_paise > 0 ? "text-volt-deep" : "text-signal"}>
                          {t.delta_paise > 0 ? "+" : "−"}
                          {formatPaise(Math.abs(t.delta_paise))}
                        </td>
                        <td>{formatPaise(t.balance_after_paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The member's player card: a framed cover, the avatar in a ring, badges, and
 * a row of stat tiles. Overview shows it with quick actions; Profile shows it
 * as a preview of what other players see.
 */
function PlayerCard({
  profile,
  name,
  age,
  badges,
  rank,
  followersCount,
  followingCount,
  unreadCount,
  variant,
}: {
  profile: PlayerProfileData;
  name: string;
  age: number | null | undefined;
  badges: UserBadge[];
  rank: number | null;
  followersCount: number;
  followingCount: number;
  unreadCount: number;
  variant: "overview" | "profile";
}) {
  const stats = [
    { label: "DUPR", value: profile.dupr != null ? Number(profile.dupr).toFixed(2) : "Unrated", href: tabHref("profile") },
    { label: "Club rank", value: rank ? `#${rank}` : "—", href: tabHref("rankings") },
    { label: "Followers", value: String(followersCount), href: tabHref("profile"), list: "followers" as const },
    { label: "Following", value: String(followingCount), href: tabHref("profile"), list: "following" as const },
  ] as Array<{ label: string; value: string; href: string; list?: "followers" | "following" }>;
  const [list, setList] = useState<"followers" | "following" | null>(null);
  return (
    <section className="demo-player-card-frame" aria-label="Your player card">
      <div className="demo-player-cover" aria-hidden="true">
        <span className="demo-player-cover-lines" />
      </div>
      <div className="demo-player-body">
        <div className="demo-player-avatar">
          <Avatar name={name} src={profile.avatar_url} size="lg" />
          <Link href={tabHref("profile")} className="demo-player-avatar-edit" title="Update profile photo" aria-label="Update profile photo">
            <UserCog size={13} />
          </Link>
        </div>
        <div className="demo-player-id">
          <p className="demo-player-kicker">
            <span>{LEVEL_LABEL[profile.skill_level] ?? profile.skill_level ?? "Player"}</span>
            {profile.handle && <span className="demo-player-handle">@{profile.handle}</span>}
          </p>
          <h1>{name}</h1>
          <p className="demo-player-meta">
            {age ? <span>{age} yrs</span> : null}
            {profile.gender && profile.gender !== "undisclosed" && <span className="capitalize">{profile.gender}</span>}
            {profile.city && (
              <span>
                <MapPin size={12} /> {profile.city}
              </span>
            )}
          </p>
          {badges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <BadgeChip key={b.id} badge={b.badge} label={b.label} />
              ))}
            </div>
          )}
          {variant === "profile" && profile.bio && <p className="demo-player-bio">{profile.bio}</p>}
        </div>
        <div className="demo-player-stats">
          {stats.map((s) =>
            s.list && variant === "profile" ? (
              <button key={s.label} type="button" className="demo-stat-tap" onClick={() => setList(s.list!)} aria-haspopup="dialog">
                <span className="demo-stat-label">{s.label}</span>
                <span className="demo-stat-value">{s.value}</span>
                <span className="demo-stat-hint">View list <ChevronRight size={12} /></span>
              </button>
            ) : (
              <Link key={s.label} href={s.href}>
                <span className="demo-stat-label">{s.label}</span>
                <span className="demo-stat-value">{s.value}</span>
              </Link>
            ),
          )}
        </div>
        <div className="demo-player-actions">
          {variant === "overview" ? (
            <>
              <Link href="/dashboard/play" className="btn-volt btn-sm">
                <CalendarDays size={14} /> Book a game
              </Link>
              <Link href={tabHref("activity")} className="demo-passport-btn relative" aria-label={`Activity${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}>
                <Bell size={16} />
                {unreadCount > 0 && <span className="demo-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </Link>
              {profile.handle && (
                <Link href={`/players/${profile.handle}`} target="_blank" className="demo-passport-btn" aria-label="Public profile">
                  <ExternalLink size={15} />
                </Link>
              )}
            </>
          ) : (
            <>
              {profile.handle && (
                <Link href={`/players/${profile.handle}`} target="_blank" className="btn-outline btn-sm">
                  <ExternalLink size={14} /> View public page
                </Link>
              )}
              <LogoutButton />
            </>
          )}
        </div>
      </div>
      {list && <FollowSheet view={list} onClose={() => setList(null)} />}
    </section>
  );
}

/** Followers / following as a sheet over the profile, closed by tap-out, ✕ or Esc. */
function FollowSheet({ view, onClose }: { view: "followers" | "following"; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="demo-follow-sheet"
      aria-label={view === "followers" ? "Followers" : "Following"}
      onCancel={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="demo-follow-sheet-inner">
        <div className="demo-follow-sheet-head">
          <h2>{view === "followers" ? "Followers" : "Following"}</h2>
          <button type="button" onClick={onClose} className="demo-passport-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <PlayerDirectory initial={[]} signedIn fixedView={view} />
      </div>
    </dialog>
  );
}

function OpenCard({ s }: { s: OpenStatus }) {
  const inIt = s.confirmed.length > 0;
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Sparvic Open · 30 Oct – 1 Nov</p>
        <Link href="/dashboard/sparvic-open" className="text-xs font-semibold text-volt-deep hover:underline">Tournament tab</Link>
      </div>
      <h2 className="mt-2 text-2xl">{inIt ? "You're in the Sparvic Open" : "Registration is open"}</h2>
      {inIt && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {s.confirmed.map((c) => (
            <li key={`${c.reference}-${c.label}`}>
              <Link href={`/dashboard/sparvic-open/confirmation/${c.reference}`} className="chip-volt">{c.label} · Confirmed</Link>
            </li>
          ))}
        </ul>
      )}
      {s.pendingRefs.length > 0 && (
        <p className="mt-3 text-sm text-signal">{s.pendingRefs.length} entr{s.pendingRefs.length === 1 ? "y is" : "ies are"} awaiting payment.</p>
      )}
      {s.more.length > 0 ? (
        <>
          <p className="mt-3 text-sm text-ink/65">
            Your DUPR {inIt ? "also " : ""}fits {s.more.length} {inIt ? "more " : ""}categor{s.more.length === 1 ? "y" : "ies"}: {s.more.join(", ")}.
          </p>
          <Link href="/dashboard/sparvic-open" className="btn-volt btn-sm mt-4">
            <Trophy size={14} /> {inIt ? "Add more categories" : "Register now"}
          </Link>
        </>
      ) : (
        !inIt && (
          <Link href="/dashboard/sparvic-open" className="btn-volt btn-sm mt-4">
            <Trophy size={14} /> See categories
          </Link>
        )
      )}
    </section>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="mb-6">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 headline-page">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink/65">{sub}</p>
    </div>
  );
}

type BookingKind = "games" | "coaching" | "tournaments" | "orders";

function BookingsSection({ games, coaching, entries, orders }: { games: GameRow[]; coaching: CoachRow[]; entries: EntryRow[]; orders: OrderRow[] }) {
  const [kind, setKind] = useState<BookingKind>("games");
  const kinds: Array<{ key: BookingKind; label: string; n: number }> = [
    { key: "games", label: "Daily games", n: games.length },
    { key: "coaching", label: "Coaching", n: coaching.length },
    { key: "tournaments", label: "Tournaments", n: entries.length },
    { key: "orders", label: "Shop orders", n: orders.length },
  ];
  return (
    <div className="mt-8">
      <SectionHead eyebrow="Booking history" title="My bookings" sub="Every game, session, entry and order in one place." />
      <div className="demo-pill-row" role="tablist" aria-label="Booking type">
        {kinds.map((k) => (
          <button key={k.key} type="button" role="tab" aria-selected={kind === k.key} onClick={() => setKind(k.key)}>
            {k.label} <span>{k.n}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {kind === "games" &&
          (games.length === 0 ? (
            <EmptyState
              title="No games booked yet"
              sub="Pick a slot for this week and your court number lands on WhatsApp."
              action={<Link href="/dashboard/play" className="btn-volt btn-sm mt-2">Book a slot</Link>}
            />
          ) : (
            <GameBookings games={games} />
          ))}

        {kind === "coaching" &&
          (coaching.length === 0 ? (
            <EmptyState title="No coaching yet" sub="Book a session with a Sparvic coach." action={<Link href="/dashboard/coaching" className="btn-volt btn-sm mt-2">Get coached</Link>} />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Ref</th><th>Coach</th><th>First session</th><th>Sessions</th><th>Amount</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {coaching.map((c) => (
                    <tr key={c.booking_no}>
                      <td className="font-mono text-xs text-volt-deep">{c.booking_no}</td>
                      <td>{c.coach_name}</td>
                      <td>{c.preferred_date ? `${formatDate(c.preferred_date)} · ${c.preferred_time}` : "—"}</td>
                      <td>{c.sessions_count}</td>
                      <td>{formatPaise(c.amount_paise)}</td>
                      <td><span className="chip capitalize">{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {kind === "tournaments" &&
          (entries.length === 0 ? (
            <EmptyState title="No tournament entries" sub="Entries are open to every registered player." action={<Link href="/dashboard/tournaments" className="btn-volt btn-sm mt-2">See tournaments</Link>} />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Ref</th><th>Tournament</th><th>Starts</th><th>Team</th><th>Category</th><th>Group</th><th>Entry fee</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.reference}>
                      <td className="font-mono text-xs text-volt-deep">{e.reference}</td>
                      <td><Link href={e.href ?? `/tournaments/${e.tournament_slug}`} className="font-semibold hover:underline">{e.tournament_title}</Link></td>
                      <td className="whitespace-nowrap">{formatDate(e.starts_on)}</td>
                      <td>{e.team_name}</td>
                      <td className="capitalize">{e.category ?? "—"}</td>
                      <td>{e.group_name ?? "To be drawn"}</td>
                      <td>{formatPaise(e.amount_paise)}</td>
                      <td>
                        <span className={e.status === "withdrawn" ? "chip" : e.payment_status === "paid" ? "chip-volt" : "chip-warn"}>
                          {e.status === "withdrawn" ? "Withdrawn" : e.status === "waitlist" ? "Waitlisted" : e.payment_status === "paid" ? "Confirmed" : "Fee due"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {kind === "orders" &&
          (orders.length === 0 ? (
            <EmptyState title="No orders yet" sub="Paddles, balls and grips from the pro shop." action={<Link href="/products" className="btn-volt btn-sm mt-2">Visit the shop</Link>} />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Order</th><th>Placed</th><th>Total</th><th>Payment</th><th>Status</th><th>Latest update</th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.order_no}>
                      <td><Link href={`/order/${o.order_no}`} className="font-mono text-xs text-volt-deep hover:underline">{o.order_no}</Link></td>
                      <td>{new Date(o.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                      <td>{formatPaise(o.total_paise)}</td>
                      <td className="capitalize">{o.payment_status}</td>
                      <td><span className={o.fulfillment_status === "delivered" ? "chip-volt" : "chip"}>{ORDER_STATUS[o.fulfillment_status] ?? o.fulfillment_status}</span></td>
                      <td className="text-xs text-ink/60">
                        {o.last_note || o.courier || o.last_update ? (
                          <>
                            {o.last_note && <span className="block text-ink/75">{o.last_note}</span>}
                            {o.courier && <span className="block">{o.courier}{o.tracking_ref ? ` · ${o.tracking_ref}` : ""}</span>}
                            {o.last_update && <span className="block text-ink/40">{new Date(o.last_update).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span>}
                          </>
                        ) : (
                          <span className="text-ink/30">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}


/**
 * The launch-time overview: what a new player should do next, in order, with
 * each step ticking itself off as the profile fills in.
 */
function LaunchOverview({
  profile,
  followingCount,
  switchTab,
}: {
  profile: PlayerProfileData;
  followingCount: number;
  switchTab: (tab: TabKey) => void;
}) {
  const steps = [
    { done: true, title: "Create your account", sub: "You are in. Welcome to Sparvic.", action: null },
    {
      done: Boolean(profile.avatar_url),
      title: "Add a profile photo",
      sub: "Players recognise faces, not names.",
      action: { label: "Add photo", tab: "profile" as TabKey },
    },
    {
      done: Boolean(profile.bio && profile.bio.trim()),
      title: "Write a short bio",
      sub: "How long you have played, when you like to play, your favourite shot.",
      action: { label: "Write bio", tab: "profile" as TabKey },
    },
    {
      done: profile.dupr != null,
      title: "Add your DUPR rating",
      sub: "Optional — helps others find players at their level.",
      action: { label: "Add rating", tab: "profile" as TabKey },
    },
    {
      done: followingCount > 0,
      title: "Follow players you know",
      sub: "You will hear when they are on court.",
      action: { label: "Find players", tab: "community" as TabKey },
    },
  ];
  const doneCount = steps.filter((st) => st.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="card min-w-0 p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Get set up</p>
            <h2 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">
              {doneCount === steps.length ? "Your profile is complete" : "Finish your player profile"}
            </h2>
          </div>
          <p className="font-mono text-sm tabular-nums text-ink/60">
            {doneCount}/{steps.length} done
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-mist" aria-hidden>
          <div className="h-full rounded-full bg-volt transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        <ol className="mt-6 space-y-2.5">
          {steps.map((st) => (
            <li
              key={st.title}
              className={`flex items-center gap-3 rounded-xl border p-3.5 sm:gap-4 sm:p-4 ${st.done ? "border-line bg-mist/30" : "border-line bg-paper"}`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${st.done ? "bg-volt text-ink" : "border-2 border-line text-ink/30"}`}
                aria-hidden
              >
                {st.done ? <Check size={16} strokeWidth={3} /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] font-semibold ${st.done ? "text-ink/55 line-through decoration-ink/25" : "text-ink"}`}>
                  {st.title}
                  <span className="sr-only">{st.done ? " (done)" : " (to do)"}</span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink/55">{st.sub}</p>
              </div>
              {!st.done && st.action && (
                <button
                  type="button"
                  onClick={() => switchTab(st.action.tab)}
                  className="btn-outline btn-sm shrink-0 whitespace-nowrap text-xs"
                >
                  {st.action.label}
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="grid min-w-0 content-start gap-6">
        <section className="card p-6">
          <Compass size={18} className="text-volt-deep" />
          <h3 className="mt-3 text-lg font-bold text-ink">Find your people</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink/60">
            Browse everyone who has registered, see their level, and follow the ones you want to rally with.
          </p>
          <button type="button" onClick={() => switchTab("community")} className="btn-volt mt-4 w-full">
            <Users size={16} /> Discover players
          </button>
          <p className="mt-3 text-center text-xs text-ink/50">
            Following {followingCount} {followingCount === 1 ? "player" : "players"}
          </p>
        </section>

        <section className="card p-6">
          <p className="eyebrow">Coming soon</p>
          <h3 className="mt-2 text-lg font-bold text-ink">Courts, coaching &amp; the shop</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink/60">
            Booking opens at launch. We will message you on WhatsApp the moment it does.
          </p>
          {profile.handle && (
            <Link
              href={`/players/${profile.handle}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-volt-deep hover:underline"
            >
              See your public page <ArrowRight size={14} />
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

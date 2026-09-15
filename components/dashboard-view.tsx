"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Compass,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  Package,
  Trophy,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { EmptyState } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { WalletTopUp } from "@/components/wallet-topup";
import { Avatar } from "@/components/player-directory";
import { DiscoverPlayers } from "@/components/discover-players";
import { ActivityFeed } from "@/components/activity-feed";
import { formatDate, formatTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { ageFrom } from "@/lib/profile";
import type { WalletTransaction } from "@/lib/wallet";
import type { UserNotification } from "@/lib/notifications";

export type GameRow = {
  id: string;
  session_date: string;
  start_time: string;
  venue_name: string;
  court_number: number | null;
  status: string;
  payment_status: string;
  amount_paise: number;
};

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
};

export type OrderRow = {
  order_no: string;
  total_paise: number;
  fulfillment_status: string;
  payment_status: string;
  created_at: string;
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

export type TabKey = "overview" | "discover" | "activity" | "profile" | "wallet";

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
}) {
  const validTabs: TabKey[] = ["overview", "discover", "activity", "profile", "wallet"];
  const [activeTab, setActiveTab] = useState<TabKey>(
    validTabs.includes(initialTab) ? initialTab : "overview"
  );

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "overview") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.replaceState({}, "", url.toString());
    }
  }

  const upcoming = games.filter((g) => g.status === "confirmed").length;
  const walletPaise = Number(profile?.wallet_balance_paise ?? 0);
  const calculatedAge = profile.age ?? ageFrom(profile.date_of_birth);

  return (
    <div className="wrap section">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My account</p>
          <h1 className="mt-2 headline-page">{profile.full_name || session.name}</h1>
          <p className="mt-1 text-sm text-ink/55">{session.email}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Button */}
          <button
            type="button"
            onClick={() => switchTab("activity")}
            className="relative rounded-full border border-line p-2 text-ink/70 transition-colors hover:bg-mist hover:text-ink"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-volt px-1 font-mono text-[9px] font-bold text-ink">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {profile.handle && (
            <Link
              href={`/players/${profile.handle}`}
              className="btn-outline btn-sm inline-flex items-center gap-1.5"
            >
              <ExternalLink size={13} /> Public profile
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Account Tab Switcher */}
      <div className="mt-8 border-b border-line">
        <div className="flex flex-wrap gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => switchTab("overview")}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition-all ${
              activeTab === "overview"
                ? "border-volt-deep text-ink bg-mist/60 rounded-t-lg"
                : "border-transparent text-ink/60 hover:text-ink hover:bg-mist/30 rounded-t-lg"
            }`}
          >
            <LayoutDashboard size={15} className={activeTab === "overview" ? "text-volt-deep" : "text-ink/50"} />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("discover")}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition-all ${
              activeTab === "discover"
                ? "border-volt-deep text-ink bg-mist/60 rounded-t-lg"
                : "border-transparent text-ink/60 hover:text-ink hover:bg-mist/30 rounded-t-lg"
            }`}
          >
            <Compass size={15} className={activeTab === "discover" ? "text-volt-deep" : "text-ink/50"} />
            <span>Discover</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("activity")}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition-all ${
              activeTab === "activity"
                ? "border-volt-deep text-ink bg-mist/60 rounded-t-lg"
                : "border-transparent text-ink/60 hover:text-ink hover:bg-mist/30 rounded-t-lg"
            }`}
          >
            <Bell size={15} className={activeTab === "activity" ? "text-volt-deep" : "text-ink/50"} />
            <span>Activity</span>
            {unreadCount > 0 && (
              <span className="ml-1 rounded-full bg-volt px-1.5 py-0.2 font-mono text-[10px] font-bold text-ink">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => switchTab("profile")}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition-all ${
              activeTab === "profile"
                ? "border-volt-deep text-ink bg-mist/60 rounded-t-lg"
                : "border-transparent text-ink/60 hover:text-ink hover:bg-mist/30 rounded-t-lg"
            }`}
          >
            <UserCog size={15} className={activeTab === "profile" ? "text-volt-deep" : "text-ink/50"} />
            <span>Profile</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("wallet")}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition-all ${
              activeTab === "wallet"
                ? "border-volt-deep text-ink bg-mist/60 rounded-t-lg"
                : "border-transparent text-ink/60 hover:text-ink hover:bg-mist/30 rounded-t-lg"
            }`}
          >
            <Wallet size={15} className={activeTab === "wallet" ? "text-volt-deep" : "text-ink/50"} />
            <span>Wallet</span>
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="mt-8 space-y-10">
          {/* Quick Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: CalendarDays, k: `${upcoming}`, v: "Game bookings" },
              { icon: GraduationCap, k: `${coaching.length}`, v: "Coaching bookings" },
              { icon: Trophy, k: `${entries.length}`, v: "Tournament entries" },
              { icon: Package, k: `${orders.length}`, v: "Orders" },
            ].map((s) => (
              <div key={s.v} className="card p-5">
                <s.icon size={17} className="text-volt-deep" />
                <p className="mt-3 font-display text-4xl text-ink">{s.k}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">{s.v}</p>
              </div>
            ))}
          </div>

          {/* Snapshot Summary Cards: Profile, Discover, & Wallet */}
          <div className="grid min-w-0 gap-5 lg:grid-cols-3">
            {/* Profile Snapshot */}
            <div className="card flex flex-col p-6">
              <div className="flex items-center gap-3">
                <Avatar name={profile.full_name || session.name} src={profile.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Your Profile</p>
                  <p className="truncate text-base font-bold text-ink">{profile.full_name || session.name}</p>
                  <p className="text-xs text-ink/60">
                    {calculatedAge ? `${calculatedAge} yrs` : "Age not set"}
                    {profile.gender ? ` · ${profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-line bg-mist/30 p-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-ink/60">DUPR: </span>
                  <span className="font-mono font-bold text-ink">
                    {profile.dupr ? Number(profile.dupr).toFixed(2) : "Unrated"}
                  </span>
                </div>
                <span className="chip-volt capitalize text-[10px]">
                  {profile.skill_level || "Beginner"}
                </span>
              </div>

              <div className="mt-auto pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => switchTab("profile")}
                  className="btn-outline btn-sm inline-flex items-center gap-1 text-xs w-full justify-center"
                >
                  <UserCog size={13} /> View &amp; Edit Profile
                </button>
              </div>
            </div>

            {/* Discover Snapshot */}
            <div className="card flex flex-col p-6">
              <Compass size={18} className="text-volt-deep" />
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Pickleball Community</p>
              <h3 className="mt-1 text-lg font-bold text-ink">Discover Players</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">
                Follow fellow players, challenge opponents, and get notified whenever friends book daily games or register for tournaments.
              </p>
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => switchTab("discover")}
                  className="btn-volt btn-sm inline-flex items-center gap-1.5 text-xs w-full justify-center"
                >
                  <Users size={13} /> Search &amp; Follow Players
                </button>
              </div>
            </div>

            {/* Wallet Snapshot */}
            <div className="card flex flex-col p-6">
              <Wallet size={18} className="text-volt-deep" />
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">SuperPro wallet</p>
              <p className="mt-1 font-display text-4xl text-volt-deep">{formatPaise(walletPaise)}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink/55">
                Prepaid credit for instant slot &amp; tournament checkout.
              </p>
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => switchTab("wallet")}
                  className="btn-outline btn-sm inline-flex items-center gap-1 text-xs w-full justify-center"
                >
                  <Wallet size={13} /> Manage Wallet
                </button>
              </div>
            </div>
          </div>

          {/* Game Bookings */}
          <section>
            <h2 className="mb-5 text-3xl">Game bookings</h2>
            {games.length === 0 ? (
              <EmptyState
                title="No games booked yet"
                sub="Pick a slot for this week and your court number lands on WhatsApp."
                action={
                  <Link href="/games" className="btn-volt btn-sm mt-2">
                    Book a slot
                  </Link>
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Venue</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((g) => (
                      <tr key={g.id}>
                        <td>{formatDate(g.session_date)}</td>
                        <td>{formatTime(g.start_time)}</td>
                        <td>{g.venue_name}</td>
                        <td>{formatPaise(g.amount_paise)}</td>
                        <td>
                          <span
                            className={
                              g.status === "cancelled"
                                ? "chip"
                                : g.payment_status === "paid"
                                ? "chip-volt"
                                : "chip-warn"
                            }
                          >
                            {g.status === "cancelled"
                              ? "Cancelled"
                              : g.payment_status === "paid"
                              ? "Paid"
                              : "Pay at venue"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Coaching Bookings */}
          {coaching.length > 0 && (
            <section>
              <h2 className="mb-5 text-3xl">Coaching</h2>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Ref</th>
                      <th>Coach</th>
                      <th>First session</th>
                      <th>Sessions</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coaching.map((c) => (
                      <tr key={c.booking_no}>
                        <td className="font-mono text-xs text-volt-deep">{c.booking_no}</td>
                        <td>{c.coach_name}</td>
                        <td>
                          {c.preferred_date ? `${formatDate(c.preferred_date)} · ${c.preferred_time}` : "—"}
                        </td>
                        <td>{c.sessions_count}</td>
                        <td>{formatPaise(c.amount_paise)}</td>
                        <td>
                          <span className="chip capitalize">{c.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Tournament Entries */}
          {entries.length > 0 && (
            <section>
              <h2 className="mb-5 text-3xl">Tournament entries</h2>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Ref</th>
                      <th>Tournament</th>
                      <th>Starts</th>
                      <th>Team</th>
                      <th>Category</th>
                      <th>Group</th>
                      <th>Entry fee</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.reference}>
                        <td className="font-mono text-xs text-volt-deep">{e.reference}</td>
                        <td>
                          <Link
                            href={`/tournaments/${e.tournament_slug}`}
                            className="font-semibold hover:underline"
                          >
                            {e.tournament_title}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">{formatDate(e.starts_on)}</td>
                        <td>{e.team_name}</td>
                        <td className="capitalize">{e.category ?? "—"}</td>
                        <td>{e.group_name ?? "To be drawn"}</td>
                        <td>{formatPaise(e.amount_paise)}</td>
                        <td>
                          <span
                            className={
                              e.status === "withdrawn"
                                ? "chip"
                                : e.payment_status === "paid"
                                ? "chip-volt"
                                : "chip-warn"
                            }
                          >
                            {e.status === "withdrawn"
                              ? "Withdrawn"
                              : e.status === "waitlist"
                              ? "Waitlisted"
                              : e.payment_status === "paid"
                              ? "Confirmed"
                              : "Fee due"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Orders */}
          {orders.length > 0 && (
            <section>
              <h2 className="mb-5 text-3xl">Orders</h2>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Placed</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.order_no}>
                        <td>
                          <Link
                            href={`/order/${o.order_no}`}
                            className="font-mono text-xs text-volt-deep hover:underline"
                          >
                            {o.order_no}
                          </Link>
                        </td>
                        <td>{new Date(o.created_at).toLocaleDateString("en-IN")}</td>
                        <td>{formatPaise(o.total_paise)}</td>
                        <td className="capitalize">{o.payment_status}</td>
                        <td>
                          <span className="chip capitalize">{o.fulfillment_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Tournaments CTA */}
          <div className="mt-14 flex flex-col gap-5 border-t-2 border-ink pt-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl">
                <Trophy size={20} className="text-volt-deep" /> Ready for a draw?
              </h2>
              <p className="mt-2 max-w-md text-sm text-ink/65">
                Entries are open to every registered player. Grab a partner and enter.
              </p>
            </div>
            <Link href="/tournaments" className="btn-outline btn-sm shrink-0">
              See tournaments
            </Link>
          </div>
        </div>
      )}

      {/* TAB 2: DISCOVER (Search & Follow Players) */}
      {activeTab === "discover" && (
        <div className="mt-8">
          <DiscoverPlayers currentUserId={session.id} />
        </div>
      )}

      {/* TAB 3: ACTIVITY (Follower & Following Circle Alerts) */}
      {activeTab === "activity" && (
        <div className="mt-8 max-w-3xl">
          <ActivityFeed initialNotifications={notifications} initialUnreadCount={unreadCount} />
        </div>
      )}

      {/* TAB 4: PROFILE (View & Edit Profile) */}
      {activeTab === "profile" && (
        <div className="mt-8 max-w-3xl space-y-8">
          <div>
            <p className="eyebrow">Player profile</p>
            <h2 className="mt-2 headline-page">View &amp; Edit Profile</h2>
            <p className="mt-2 text-sm text-ink/65">
              Keep your player identity up to date. Your profile photo, age, sex, and DUPR level determine your tournament brackets and match eligibility.
            </p>
          </div>

          {/* Public Profile Badge */}
          {profile.handle && (
            <div className="card flex items-center justify-between p-4 bg-mist/30">
              <div className="flex items-center gap-3">
                <Avatar name={profile.full_name} src={profile.avatar_url} size="sm" />
                <div>
                  <p className="text-xs font-semibold text-ink">Public Player Page</p>
                  <p className="font-mono text-[11px] text-ink/50">/players/{profile.handle}</p>
                </div>
              </div>
              <Link
                href={`/players/${profile.handle}`}
                target="_blank"
                className="btn-outline btn-sm inline-flex items-center gap-1 text-xs"
              >
                <span>View Public Page</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          )}

          {/* Profile Form (Photo + All Compulsory & Optional Details) */}
          <ProfileForm
            profile={profile}
            hideWallet={true}
          />
        </div>
      )}

      {/* TAB 5: WALLET */}
      {activeTab === "wallet" && (
        <div className="mt-8 max-w-3xl space-y-8">
          <div>
            <p className="eyebrow">SuperPro Wallet</p>
            <h2 className="mt-2 headline-page">Credit &amp; Top Up</h2>
            <p className="mt-2 text-sm text-ink/65">
              Prepaid balance used for instant checkout on game bookings, coaching sessions, tournaments, and shop items.
            </p>
          </div>

          {/* Wallet Balance & Topup Card */}
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
                  <Wallet size={13} className="text-volt-deep" /> Current balance
                </p>
                <p className="mt-1 font-display text-5xl text-volt-deep">{formatPaise(walletPaise)}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-line/60 pt-5">
              <h3 className="text-lg font-semibold text-ink mb-3">Load wallet credit</h3>
              <WalletTopUp
                razorpayEnabled={razorpayEnabled}
                razorpayKeyId={razorpayKeyId}
                name={profile.full_name}
                email={profile.email}
                phone={profile.phone}
              />
            </div>
          </div>

          {/* Transactions Ledger */}
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
                        <td>{new Date(t.created_at).toLocaleDateString("en-IN")}</td>
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

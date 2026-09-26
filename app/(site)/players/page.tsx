import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Avatar, PlayerDirectory, type DirectoryPlayer, type FollowCounts } from "@/components/player-directory";
import { getPlayerSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { formatDate } from "@/lib/dates";
import { LEVEL_LABEL } from "@/lib/levels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Community",
  description: "Find other Sparvic players in Kolkata, see who is on court this week, and follow the ones you want to rally with.",
};

type OnCourt = {
  handle: string;
  full_name: string;
  avatar_url: string | null;
  skill_level: string;
  session_date: string;
  start_time: string;
  venue_name: string;
  games: number;
};

type Me = {
  handle: string | null;
  full_name: string;
  avatar_url: string | null;
  skill_level: string;
};

export default async function CommunityPage() {
  await ensureSchema();
  const session = await getPlayerSession();
  const me = session?.id ?? null;

  const [players, onCourt, summary] = await Promise.all([
    query<DirectoryPlayer>(
      `SELECT u.id, u.handle, u.full_name, u.avatar_url, u.city, u.skill_level, u.dupr,
              COALESCE((SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id), 0)::int AS followers,
              EXISTS (SELECT 1 FROM follows a WHERE a.following_id = u.id AND a.follower_id = $1::uuid) AS is_following,
              EXISTS (SELECT 1 FROM follows b WHERE b.follower_id  = u.id AND b.following_id = $1::uuid) AS follows_me
       FROM users u
       WHERE u.handle IS NOT NULL AND COALESCE(u.role, 'player') = 'player'
         AND ($1::uuid IS NULL OR u.id <> $1::uuid)
       ORDER BY follows_me DESC, followers DESC, u.full_name
       LIMIT 36`,
      [me],
    ).catch(() => []),

    // Who is actually playing in the next week. Rosters are public by design —
    // the point of seeing it is to book the same court.
    query<OnCourt>(
      // DISTINCT ON picks each player's next game; the outer query then keeps
      // the twelve soonest. Limiting inside would keep twelve arbitrary ids.
      `SELECT * FROM (
         SELECT DISTINCT ON (u.id)
                u.handle, u.full_name, u.avatar_url, u.skill_level,
                s.session_date::text AS session_date, s.start_time, v.name AS venue_name,
                COUNT(*) OVER (PARTITION BY u.id)::int AS games
         FROM game_registrations r
         JOIN users u ON u.id = r.user_id
         JOIN game_sessions s ON s.id = r.session_id
         JOIN venues v ON v.id = s.venue_id
         WHERE r.status = 'confirmed' AND u.handle IS NOT NULL
           AND COALESCE(u.role, 'player') = 'player'
           AND s.session_date BETWEEN (now() AT TIME ZONE 'Asia/Kolkata')::date
                                  AND (now() AT TIME ZONE 'Asia/Kolkata')::date + 7
         ORDER BY u.id, s.session_date, s.start_time
       ) t
       ORDER BY session_date, start_time
       LIMIT 12`,
    ).catch(() => []),

    // Page stats and the viewer's own summary in a single round trip.
    queryOne<{
      players: number;
      this_week: number;
      handle: string | null;
      full_name: string | null;
      avatar_url: string | null;
      skill_level: string | null;
      following: number;
      followers: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE handle IS NOT NULL AND COALESCE(role,'player') = 'player')::int AS players,
         (SELECT COUNT(*) FROM game_registrations r JOIN game_sessions s ON s.id = r.session_id
           WHERE r.status = 'confirmed'
             AND s.session_date BETWEEN (now() AT TIME ZONE 'Asia/Kolkata')::date
                                    AND (now() AT TIME ZONE 'Asia/Kolkata')::date + 7)::int AS this_week,
         me.handle, me.full_name, me.avatar_url, me.skill_level,
         (SELECT COUNT(*) FROM follows WHERE follower_id = $1::uuid)::int  AS following,
         (SELECT COUNT(*) FROM follows WHERE following_id = $1::uuid)::int AS followers
       FROM (SELECT 1) one
       LEFT JOIN users me ON me.id = $1::uuid`,
      [me],
    ).catch(() => null),
  ]);

  const upcoming = onCourt;
  const stats = summary ? { players: summary.players, this_week: summary.this_week } : null;
  const mine: Me | null =
    me && summary?.full_name
      ? {
          handle: summary.handle,
          full_name: summary.full_name,
          avatar_url: summary.avatar_url,
          skill_level: summary.skill_level ?? "beginner",
        }
      : null;
  const counts: FollowCounts | null = me && summary ? { following: summary.following, followers: summary.followers } : null;

  return (
    <div className="wrap section">
      <header className="grid gap-8 lg:grid-cols-[1fr_minmax(0,22rem)] lg:items-end">
        <div>
          <p className="eyebrow">Community</p>
          <h1 className="mt-3 headline-page">Find your people</h1>
          <p className="lede mt-4 max-w-2xl">
            Everyone who plays with Sparvic has a page. Find the person you rallied with last week, see what level
            they play at, and follow them to hear when they book a court.
          </p>
          {stats && (
            <p className="mt-5 font-mono text-[11px] uppercase tracking-wide text-ink/45">
              {stats.players} players · {stats.this_week} game{stats.this_week === 1 ? "" : "s"} booked this week
            </p>
          )}
        </div>

        {mine ? (
          <div className="card flex items-center gap-4 p-5">
            <Avatar name={mine.full_name} src={mine.avatar_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{mine.full_name}</p>
              <p className="font-mono text-[11px] uppercase tracking-wide text-ink/45">
                {counts?.followers ?? 0} followers · {counts?.following ?? 0} following
              </p>
            </div>
            {mine.handle && (
              <Link href={`/players/${mine.handle}`} className="btn-outline btn-sm shrink-0">
                Your page
              </Link>
            )}
          </div>
        ) : (
          <div className="card p-5">
            <p className="font-semibold text-ink">Get your own page</p>
            <p className="mt-1 text-sm text-ink/60">
              An account gives you a player page, lets you follow people, and tells you when they are on court.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/signup" className="btn-volt btn-sm">
                Create account
              </Link>
              <Link href="/login?next=/players" className="btn-outline btn-sm">
                Sign in
              </Link>
            </div>
          </div>
        )}
      </header>

      {upcoming.length > 0 && (
        <section className="mt-12" aria-labelledby="on-court">
          <div className="flex items-end justify-between gap-4">
            <h2 id="on-court" className="headline-section flex items-center gap-2">
              <CalendarDays size={20} className="text-volt-deep" /> On court this week
            </h2>
            <Link href="/games" className="hidden items-center gap-1 text-sm font-semibold text-ink/70 hover:text-ink sm:inline-flex">
              Book the same slot <ArrowRight size={14} />
            </Link>
          </div>
          {/* Scrolls sideways on a phone instead of stacking twelve tall cards. */}
          <ul className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {upcoming.map((p) => (
              <li key={p.handle} className="w-[15rem] shrink-0 snap-start sm:w-auto">
                <Link
                  href={`/players/${p.handle}`}
                  className="flex h-full flex-col gap-3 rounded-xl border border-line bg-paper p-4 transition-colors hover:border-ink/30"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={p.full_name} src={p.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{p.full_name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">
                        {LEVEL_LABEL[p.skill_level] ?? p.skill_level}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto border-t border-line pt-3 text-xs text-ink/65">
                    <p className="font-semibold text-ink">
                      {formatDate(p.session_date)} · {p.start_time}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate">
                      <MapPin size={11} className="shrink-0" /> {p.venue_name}
                      {p.games > 1 && <span className="text-ink/45"> · +{p.games - 1} more</span>}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-14" aria-labelledby="players">
        <h2 id="players" className="headline-section">
          Players
        </h2>
        <div className="mt-5">
          <PlayerDirectory
            initial={players}
            initialCounts={counts ?? { following: 0, followers: 0 }}
            signedIn={Boolean(session)}
          />
        </div>
      </section>
    </div>
  );
}

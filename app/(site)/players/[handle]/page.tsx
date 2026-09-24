import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import { Avatar, FollowButton } from "@/components/player-directory";
import { Reveal } from "@/components/motion";
import { getPlayerSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { formatDate } from "@/lib/dates";
import { LEVEL_LABEL } from "@/lib/levels";
import { ageFrom } from "@/lib/profile";

export const dynamic = "force-dynamic";

type PublicProfile = {
  id: string;
  handle: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  skill_level: string;
  dupr: number | null;
  dupr_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  created_at: string;
  followers: number;
  following: number;
  is_following: boolean;
};

/** Only the columns a player has agreed to show — never contact details. */
async function load(handle: string, viewerId: string | null) {
  return queryOne<PublicProfile>(
    `SELECT u.id, u.handle, u.full_name, u.avatar_url, u.city, u.bio, u.skill_level, u.dupr, u.dupr_id,
            u.date_of_birth::text AS date_of_birth, u.gender, u.created_at::text AS created_at,
            COALESCE((SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id), 0)::int AS followers,
            COALESCE((SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id), 0)::int AS following,
            EXISTS (SELECT 1 FROM follows f2 WHERE f2.following_id = u.id AND f2.follower_id = $2::uuid) AS is_following
     FROM users u
     WHERE lower(u.handle) = $1 AND COALESCE(u.role, 'player') = 'player'
     LIMIT 1`,
    [handle.toLowerCase(), viewerId],
  ).catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  await ensureSchema();
  const profile = await load(handle, null);
  if (!profile) return { title: "Player" };
  return {
    title: profile.full_name,
    description: `${profile.full_name} plays pickleball with SuperPro in ${profile.city ?? "Kolkata"}.`,
  };
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  await ensureSchema();
  const session = await getPlayerSession();
  const profile = await load(handle, session?.id ?? null);
  if (!profile) notFound();

  const isSelf = session?.id === profile.id;
  const age = ageFrom(profile.date_of_birth);

  // Upcoming games are public on purpose — the whole point of a profile is to
  // let someone see where a player will be and book the same court.
  const upcoming = await query<{
    session_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    level: string | null;
  }>(
    `SELECT s.session_date::text AS session_date, s.start_time, s.end_time, v.name AS venue_name, s.level
     FROM game_registrations r
     JOIN game_sessions s ON s.id = r.session_id
     JOIN venues v ON v.id = s.venue_id
     WHERE r.user_id = $1 AND r.status IN ('confirmed','pending_approval') AND s.session_date >= CURRENT_DATE
     ORDER BY s.session_date, s.start_time LIMIT 6`,
    [profile.id],
  ).catch(() => []);

  const stats = [
    { label: "Followers", value: profile.followers },
    { label: "Following", value: profile.following },
    { label: "Games booked", value: upcoming.length },
  ];

  return (
    <div className="wrap section">
      <Link href="/players" className="font-mono text-[11px] uppercase tracking-wide text-ink/45 hover:text-ink">
        ← All players
      </Link>

      <Reveal>
        <header className="mt-6 flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-start">
          <Avatar name={profile.full_name} src={profile.avatar_url} size="lg" />

          <div className="min-w-0 flex-1">
            <h1 className="headline-page">{profile.full_name}</h1>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wide text-ink/45">
              @{profile.handle}
              {age != null && ` · ${age}`}
              {profile.gender && profile.gender !== "undisclosed" && ` · ${profile.gender}`}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="chip-volt">{LEVEL_LABEL[profile.skill_level] ?? profile.skill_level}</span>
              {profile.dupr != null && <span className="chip">DUPR {Number(profile.dupr).toFixed(2)}</span>}
              {profile.dupr_id && <span className="chip">ID {profile.dupr_id}</span>}
              <span className="chip">
                <MapPin size={12} /> {profile.city ?? "Kolkata"}
              </span>
            </div>

            {profile.bio && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink/70">{profile.bio}</p>}

            <p className="mt-4 font-mono text-[11px] uppercase tracking-wide text-ink/40">
              On SuperPro since {formatDate(profile.created_at)}
            </p>
          </div>

          <div className="shrink-0">
            {isSelf ? (
              <Link href="/dashboard" className="btn-outline">
                Edit your profile
              </Link>
            ) : (
              <FollowButton
                handle={profile.handle}
                initialFollowing={profile.is_following}
                initialFollowers={profile.followers}
                signedIn={Boolean(session)}
                size="md"
              />
            )}
          </div>
        </header>
      </Reveal>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 60}>
            <div className="rounded-xl border border-line bg-paper p-5">
              <p className="font-mono text-[11px] uppercase tracking-wide text-ink/45">{s.label}</p>
              <p className="mt-1 font-display text-3xl text-ink">{s.value}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="headline-section flex items-center gap-2">
          <CalendarDays size={20} className="text-volt-deep" /> On court next
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-5 py-8 text-sm text-ink/55">
            No games booked yet.{" "}
            <Link href="/games" className="underline">
              Find a slot
            </Link>{" "}
            and you might end up on the same court.
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {upcoming.map((g, i) => (
              <Reveal as="li" key={`${g.session_date}-${g.start_time}-${i}`} delay={i * 50}>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{g.venue_name}</p>
                    <p className="font-mono text-[11px] uppercase tracking-wide text-ink/45">
                      {formatDate(g.session_date)} · {g.start_time}–{g.end_time}
                    </p>
                  </div>
                  {g.level && <span className="chip shrink-0">{LEVEL_LABEL[g.level] ?? g.level}</span>}
                </div>
              </Reveal>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 rounded-xl border border-line bg-mist p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
          <Trophy size={18} className="text-volt-deep" /> Want to play them?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/70">
          Book a slot at the same venue and time — rosters are public so you can see who else is coming before you
          pay.
        </p>
        <Link href="/games" className="btn-volt mt-5">
          Browse daily games
        </Link>
      </section>
    </div>
  );
}

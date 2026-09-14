import type { Metadata } from "next";
import { PlayerDirectory, type DirectoryPlayer } from "@/components/player-directory";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Players",
  description: "Find other SuperPro players in Kolkata, see their level, and follow the ones you want to rally with.",
};

export default async function PlayersPage() {
  await ensureSchema();
  const session = await getPlayerSession();

  const players = await query<DirectoryPlayer>(
    `SELECT u.id, u.handle, u.full_name, u.avatar_url, u.city, u.skill_level, u.dupr,
            COALESCE((SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id), 0)::int AS followers,
            EXISTS (SELECT 1 FROM follows f2 WHERE f2.following_id = u.id AND f2.follower_id = $1::uuid) AS is_following
     FROM users u
     WHERE u.handle IS NOT NULL AND COALESCE(u.role, 'player') = 'player'
     ORDER BY followers DESC, u.full_name
     LIMIT 24`,
    [session?.id ?? null],
  ).catch(() => []);

  return (
    <div className="wrap section">
      <p className="eyebrow">Community</p>
      <h1 className="mt-3 headline-page">Find your people</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink/70">
        Every SuperPro player has a page. Search for someone you rallied with last week, see what standard they
        play at, and follow them so you know when they are on court.
      </p>

      <div className="mt-10">
        <PlayerDirectory initial={players} signedIn={Boolean(session)} />
      </div>
    </div>
  );
}

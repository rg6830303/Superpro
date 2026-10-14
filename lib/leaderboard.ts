import { query } from "@/lib/db";
import type { RankRow } from "@/lib/dashboard-tabs";

/**
 * Club standings: players ordered by DUPR (unrated last), then by games
 * played, then name. Only public directory columns leave the database.
 * `includeId` keeps the viewer in the table even before they pick a handle.
 */
export async function getLeaderboard(includeId: string | null): Promise<RankRow[]> {
  return query<RankRow>(
    `WITH played AS (
       SELECT r.user_id, COUNT(*)::int AS games
       FROM game_registrations r JOIN game_sessions s ON s.id = r.session_id
       WHERE r.status = 'confirmed'
         AND ((s.session_date + s.start_time::time) AT TIME ZONE 'Asia/Kolkata') <= now()
       GROUP BY r.user_id)
     SELECT u.id, u.handle, u.full_name, u.avatar_url, u.skill_level, u.dupr,
            COALESCE(p.games, 0)::int AS games,
            (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id)::int AS followers,
            ROW_NUMBER() OVER (ORDER BY u.dupr DESC NULLS LAST, COALESCE(p.games, 0) DESC, u.full_name)::int AS rank
     FROM users u LEFT JOIN played p ON p.user_id = u.id
     WHERE COALESCE(u.role, 'player') = 'player' AND (u.handle IS NOT NULL OR u.id = $1::uuid)`,
    [includeId],
  ).catch(() => [] as RankRow[]);
}

import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type DirectoryPlayer = {
  id: string;
  handle: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  skill_level: string;
  dupr: number | null;
  followers: number;
  is_following: boolean;
  /** They follow the viewer. Together with is_following this gives "mutual". */
  follows_me: boolean;
};

/** Which slice of the directory to return. */
const VIEWS = new Set(["all", "following", "followers", "mutual"]);
/** Level filter; anything else means "every level". */
const LEVELS = new Set(["beginner", "intermediate", "advanced"]);

/**
 * The player directory.
 *
 * Only ever returns the handful of columns a player has chosen to make public —
 * never email, phone, wallet or date of birth.
 *
 * `view` is served in SQL rather than by filtering a page of results in the
 * browser. Filtering client-side silently loses anyone who happens to fall
 * outside the current page, which makes "people you follow" quietly wrong as
 * soon as someone follows more than a screenful.
 */
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 24) || 24, 48);
    const viewParam = url.searchParams.get("view") ?? "all";
    const view = VIEWS.has(viewParam) ? viewParam : "all";
    const levelParam = url.searchParams.get("level") ?? "";
    const level = LEVELS.has(levelParam) ? levelParam : "";
    const session = await getPlayerSession();
    const me = session?.id ?? null;

    // Relationship views need a signed-in viewer to mean anything.
    if (view !== "all" && !me) return NextResponse.json({ players: [], view, signed_in: false });

    const relationship =
      view === "following"
        ? "AND EXISTS (SELECT 1 FROM follows f WHERE f.following_id = u.id AND f.follower_id = $3::uuid)"
        : view === "followers"
          ? "AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.following_id = $3::uuid)"
          : view === "mutual"
            ? `AND EXISTS (SELECT 1 FROM follows f WHERE f.following_id = u.id AND f.follower_id = $3::uuid)
               AND EXISTS (SELECT 1 FROM follows f2 WHERE f2.follower_id = u.id AND f2.following_id = $3::uuid)`
            : "";

    const players = await query<DirectoryPlayer>(
      `SELECT u.id, u.handle, u.full_name, u.avatar_url, u.city, u.skill_level, u.dupr,
              COALESCE((SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id), 0)::int AS followers,
              EXISTS (SELECT 1 FROM follows a WHERE a.following_id = u.id AND a.follower_id = $3::uuid) AS is_following,
              EXISTS (SELECT 1 FROM follows b WHERE b.follower_id  = u.id AND b.following_id = $3::uuid) AS follows_me
       FROM users u
       WHERE u.handle IS NOT NULL
         AND COALESCE(u.role, 'player') = 'player'
         -- Never list the viewer to themselves; doing it in SQL keeps the page
         -- size honest instead of returning 24 and rendering 23.
         AND ($3::uuid IS NULL OR u.id <> $3::uuid)
         AND ($1 = '' OR u.full_name ILIKE '%' || $1 || '%' OR u.handle ILIKE '%' || $1 || '%'
              OR COALESCE(u.city, '') ILIKE '%' || $1 || '%' OR u.skill_level ILIKE '%' || $1 || '%')
         AND ($4 = '' OR u.skill_level = $4)
         ${relationship}
       ORDER BY follows_me DESC, followers DESC, u.full_name
       LIMIT $2`,
      [q, limit, me, level],
    );

    // The viewer's own counts, so the UI can show a real profile summary rather
    // than deriving it from whatever happens to be on this page.
    let counts = { following: 0, followers: 0 };
    if (me) {
      const [row] = await query<{ following: number; followers: number }>(
        `SELECT (SELECT COUNT(*) FROM follows WHERE follower_id = $1)::int  AS following,
                (SELECT COUNT(*) FROM follows WHERE following_id = $1)::int AS followers`,
        [me],
      ).catch(() => [{ following: 0, followers: 0 }]);
      if (row) counts = row;
    }

    return NextResponse.json({ players, view, signed_in: Boolean(me), counts });
  } catch (err) {
    console.error("[players]", err);
    return NextResponse.json({ players: [], counts: { following: 0, followers: 0 } });
  }
}

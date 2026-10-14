import { query } from "@/lib/db";
import type { UserBadge } from "@/lib/badges";

export async function listUserBadges(userId: string): Promise<UserBadge[]> {
  return query<UserBadge>(
    `SELECT id, badge, label, note, created_at::text FROM user_badges WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  ).catch(() => []);
}

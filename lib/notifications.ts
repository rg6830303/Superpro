import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export type NotificationKind = "game_booking" | "tournament_entry" | "follow" | "system";

export type UserNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  actor_name?: string | null;
  actor_avatar?: string | null;
  actor_handle?: string | null;
  kind: NotificationKind;
  title: string;
  message: string;
  link_url: string | null;
  read: boolean;
  created_at: string;
};

/** Create a single notification for a specific user. */
export async function createNotification(input: {
  userId: string;
  actorId?: string | null;
  kind: NotificationKind;
  title: string;
  message: string;
  linkUrl?: string | null;
}): Promise<void> {
  try {
    await ensureSchema();
    await query(
      `INSERT INTO user_notifications (user_id, actor_id, kind, title, message, link_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.userId,
        input.actorId ?? null,
        input.kind,
        input.title.trim(),
        input.message.trim(),
        input.linkUrl ?? null,
      ],
    );
  } catch (err) {
    console.error("[notifications] createNotification failed:", err);
  }
}

/**
 * Dispatch an activity notification to all users who follow this player AND all
 * users this player follows (their entire pickleball circle).
 */
/**
 * Tell a player's followers what they just did.
 *
 * Followers only. This used to notify the people the actor follows as well,
 * which meant following someone signed them up for a ping every time you
 * booked a court — whether or not they had ever followed you back. Following
 * is how a player asks to hear about someone; it is not something done to them.
 *
 * One INSERT … SELECT rather than a round trip per follower, so a popular
 * player booking a slot costs one statement, not hundreds.
 */
export async function notifyFollowers(input: {
  actorId: string;
  kind: "game_booking" | "tournament_entry";
  title: string;
  message: string;
  linkUrl?: string | null;
}): Promise<number> {
  try {
    await ensureSchema();
    const rows = await query<{ n: number }>(
      `WITH sent AS (
         INSERT INTO user_notifications (user_id, actor_id, kind, title, message, link_url)
         SELECT f.follower_id, $1, $2, $3, $4, $5
         FROM follows f
         WHERE f.following_id = $1 AND f.follower_id <> $1
         RETURNING 1
       )
       SELECT COUNT(*)::int AS n FROM sent`,
      [input.actorId, input.kind, input.title.trim(), input.message.trim(), input.linkUrl ?? null],
    );
    return rows[0]?.n ?? 0;
  } catch (err) {
    console.error("[notifications] notifyFollowers failed:", err);
    return 0;
  }
}

/** List notifications for a given user. */
export async function listUserNotifications(userId: string, limit = 40): Promise<UserNotification[]> {
  try {
    await ensureSchema();
    return await query<UserNotification>(
      `SELECT n.id, n.user_id, n.actor_id, n.kind, n.title, n.message, n.link_url, n.read,
              n.created_at::text AS created_at,
              u.full_name AS actor_name,
              u.avatar_url AS actor_avatar,
              u.handle AS actor_handle
       FROM user_notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
  } catch (err) {
    console.error("[notifications] listUserNotifications failed:", err);
    return [];
  }
}

/** Get the count of unread notifications for a user. */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    await ensureSchema();
    const rows = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM user_notifications WHERE user_id = $1 AND read = false`,
      [userId],
    );
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

/** Mark notifications as read. If no ids provided, marks all for user. */
export async function markNotificationsAsRead(userId: string, ids?: string[]): Promise<void> {
  try {
    await ensureSchema();
    if (ids && ids.length > 0) {
      await query(
        `UPDATE user_notifications SET read = true WHERE user_id = $1 AND id = ANY($2::uuid[])`,
        [userId, ids],
      );
    } else {
      await query(
        `UPDATE user_notifications SET read = true WHERE user_id = $1 AND read = false`,
        [userId],
      );
    }
  } catch (err) {
    console.error("[notifications] markNotificationsAsRead failed:", err);
  }
}

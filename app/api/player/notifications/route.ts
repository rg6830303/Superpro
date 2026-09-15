import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import {
  listUserNotifications,
  getUnreadNotificationCount,
  markNotificationsAsRead,
} from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 30) || 30, 60);

  const [notifications, unreadCount] = await Promise.all([
    listUserNotifications(session.id, limit),
    getUnreadNotificationCount(session.id),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  await markNotificationsAsRead(session.id, body.ids);

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { istToday, formatDate, formatTimeRange } from "@/lib/dates";
import { seedSessions } from "@/lib/seed";
import { sendWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily 7:00 AM IST job (01:30 UTC, see vercel.json):
 *   1. Roll the schedule forward so there is always a full week of open slots.
 *   2. Post today's line-up — every slot, its court, and who is playing — to
 *      the daily-games WhatsApp group.
 *
 * Vercel sends CRON_SECRET as a bearer token; the endpoint refuses anything else.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    await ensureSchema();
    const created = await seedSessions(7);

    const today = istToday();
    const rows = await query<{
      session_id: string;
      start_time: string;
      end_time: string;
      court_number: number;
      venue_name: string;
      capacity: number;
      players: string[] | null;
    }>(
      `SELECT s.id AS session_id, s.start_time, s.end_time, s.court_number, v.name AS venue_name, s.capacity,
              ARRAY_REMOVE(ARRAY_AGG(r.player_name ORDER BY r.created_at)
                FILTER (WHERE r.status = 'confirmed'), NULL) AS players
       FROM game_sessions s
       JOIN venues v ON v.id = s.venue_id
       LEFT JOIN game_registrations r ON r.session_id = s.id
       WHERE s.session_date = $1 AND s.status = 'open'
       GROUP BY s.id, v.name
       HAVING COUNT(r.id) FILTER (WHERE r.status = 'confirmed') > 0
       ORDER BY s.start_time, v.name, s.court_number`,
      [today],
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, created, posted: false, reason: "no bookings today" });
    }

    const message = [
      `🏓 *SUPERPRO — TODAY ON COURT*`,
      `${formatDate(today)}`,
      ``,
      ...rows.flatMap((r) => [
        `⏰ *${formatTimeRange(r.start_time, r.end_time)}* · ${r.venue_name} · Court ${r.court_number}`,
        ...(r.players ?? []).map((p, i) => `   ${i + 1}. ${p}`),
        ``,
      ]),
      `Reach 10 minutes early. See you there.`,
    ].join("\n");

    const result = await sendWhatsApp({ kind: "daily_digest", target: "group", message });

    return NextResponse.json({ ok: true, created, slots: rows.length, delivery: result });
  } catch (err) {
    console.error("[cron/daily-digest]", err);
    return NextResponse.json({ error: "Digest failed." }, { status: 500 });
  }
}

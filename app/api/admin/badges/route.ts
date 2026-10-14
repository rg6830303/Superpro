import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { BADGES } from "@/lib/badges";
import { listUserBadges } from "@/lib/badges-server";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEYS = BADGES.map((b) => b.key) as [string, ...string[]];
const bodySchema = z.object({
  user_id: z.string().uuid("Pick a player"),
  badge: z.enum(KEYS, { message: "Pick a badge" }),
  label: z.string().trim().max(40).optional(),
  note: z.string().trim().max(200).optional(),
});

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const userId = new URL(req.url).searchParams.get("user_id");
    if (!userId) return badRequest("Missing user id.");
    return NextResponse.json({ badges: await listUserBadges(userId), catalogue: BADGES });
  } catch (err) {
    return serverError("badges:list", err);
  }
}

/** Award a badge. Custom badges are keyed by their label so several can coexist. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Check the badge.");
  try {
    await ensureSchema();
    const { user_id, badge, note } = parsed.data;
    const def = BADGES.find((b) => b.key === badge)!;
    const label = badge === "custom" ? parsed.data.label : def.label;
    if (!label) return badRequest("Name the custom badge.");
    const key = badge === "custom" ? `custom:${label.toLowerCase()}` : badge;
    const user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [user_id]);
    if (!user) return badRequest("That player no longer exists.");
    const row = await queryOne<{ id: string }>(
      `INSERT INTO user_badges (user_id, badge, label, note, awarded_by) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, badge) DO NOTHING RETURNING id`,
      [user_id, key, label, note || null, gate.email ?? null],
    );
    if (!row) return badRequest("They already have that badge.");
    await createNotification({
      userId: user_id,
      kind: "system",
      title: `You earned a badge: ${label}`,
      message: note || `The club awarded you the “${label}” badge. It now shows on your profile.`,
      linkUrl: "/dashboard/profile",
    });
    await audit(gate, "badge.award", "users", user_id, { badge: key, label });
    return NextResponse.json({ ok: true, badges: await listUserBadges(user_id) });
  } catch (err) {
    return serverError("badges:award", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing badge id.");
    const gone = await queryOne<{ user_id: string; label: string }>(`DELETE FROM user_badges WHERE id = $1 RETURNING user_id, label`, [id]);
    if (!gone) return badRequest("That badge was already removed.");
    await audit(gate, "badge.remove", "users", gone.user_id, { label: gone.label });
    return NextResponse.json({ ok: true, badges: await listUserBadges(gone.user_id) });
  } catch (err) {
    return serverError("badges:remove", err);
  }
}


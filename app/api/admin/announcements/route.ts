import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = ["title", "body", "kind", "link_url", "active", "starts_at", "ends_at"] as const;

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const announcements = await query(`SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50`);
    return NextResponse.json({ announcements });
  } catch (err) {
    return serverError("announcements:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.title || !body.body) return badRequest("Title and body are required.");
    const rows = await query<{ id: string }>(
      `INSERT INTO announcements (title, body, kind, link_url, active) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [body.title, body.body, body.kind ?? "info", body.link_url ?? null, body.active === false ? false : true],
    );
    await audit(gate, "announcement.create", "announcements", rows[0].id);
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    return serverError("announcements:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing announcement id.");
    const update = buildUpdate("announcements", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    await query(update.text, update.params);
    await audit(gate, "announcement.update", "announcements", String(body.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("announcements:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing announcement id.");
    await query(`DELETE FROM announcements WHERE id = $1`, [id]);
    await audit(gate, "announcement.delete", "announcements", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("announcements:delete", err);
  }
}

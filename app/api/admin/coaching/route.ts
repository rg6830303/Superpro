import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query, queryOne } from "@/lib/db";
import { sendWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = ["status", "payment_status", "preferred_date", "preferred_time", "notes"] as const;

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const status = new URL(req.url).searchParams.get("status");
    const bookings = await query(
      `SELECT b.*, c.name AS coach_name, c.whatsapp AS coach_whatsapp
       FROM coaching_bookings b JOIN coaches c ON c.id = b.coach_id
       WHERE ($1::text IS NULL OR b.status = $1)
       ORDER BY b.created_at DESC LIMIT 200`,
      [status],
    );
    return NextResponse.json({ bookings });
  } catch (err) {
    return serverError("coaching:list", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing booking id.");
    const update = buildUpdate("coaching_bookings", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    const rows = await query(update.text, update.params);
    await audit(gate, "coaching.update", "coaching_bookings", String(body.id), body);

    // Confirming a request is the moment the player needs to hear from us.
    if (body.status === "confirmed") {
      const booking = await queryOne<{
        booking_no: string;
        player_phone: string;
        player_name: string;
        preferred_date: string | null;
        preferred_time: string | null;
        coach_name: string;
      }>(
        `SELECT b.booking_no, b.player_phone, b.player_name, b.preferred_date, b.preferred_time, c.name AS coach_name
         FROM coaching_bookings b JOIN coaches c ON c.id = b.coach_id WHERE b.id = $1`,
        [body.id],
      );
      if (booking) {
        await sendWhatsApp({
          kind: "coaching_confirmed",
          target: "number",
          phone: `91${booking.player_phone}`,
          message: `🎾 SuperPro — ${booking.coach_name} has confirmed your session${booking.preferred_date ? ` on ${booking.preferred_date} at ${booking.preferred_time}` : ""}. Ref ${booking.booking_no}. See you on court.`,
          refTable: "coaching_bookings",
          refId: String(body.id),
        });
      }
    }

    return NextResponse.json({ ok: true, booking: rows[0] ?? null });
  } catch (err) {
    return serverError("coaching:update", err);
  }
}

/** Remove a coaching booking outright — used for spam and duplicate requests. */
export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing booking id.");
    await query(`DELETE FROM coaching_bookings WHERE id = $1`, [id]);
    await audit(gate, "coaching.delete", "coaching_bookings", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("coaching:delete", err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { query, queryOne } from "@/lib/db";
import { listAppointments } from "@/lib/doctor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    return NextResponse.json({ appointments: await listAppointments() });
  } catch (err) {
    return serverError("doctor-appointments:list", err);
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["requested", "confirmed", "completed", "cancelled"]).optional(),
  payment_status: z.enum(["unpaid", "pending", "paid", "refunded"]).optional(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferred_slot: z.string().trim().min(2).max(60).optional(),
  confirmed_at: z.union([z.literal(""), z.string().trim().max(40)]).nullable().optional(),
  admin_note: z.string().trim().max(500).nullable().optional(),
});

/** Confirm a time, mark paid (cash / UPI at the clinic), cancel, add a note. */
export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Check the appointment.");
  try {
    const { id, ...p } = parsed.data;
    const confirmed = p.confirmed_at === undefined ? undefined : p.confirmed_at ? new Date(p.confirmed_at) : null;
    if (confirmed && Number.isNaN(confirmed.getTime())) return badRequest("Confirmed time is not a valid date/time.");
    const row = await queryOne<{ id: string }>(
      `UPDATE doctor_appointments SET
         status = COALESCE($2, status),
         payment_status = COALESCE($3, payment_status),
         paid_at = CASE WHEN $3 = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
         preferred_date = COALESCE($4::date, preferred_date),
         preferred_slot = COALESCE($5, preferred_slot),
         confirmed_at = CASE WHEN $6::boolean THEN $7::timestamptz ELSE confirmed_at END,
         admin_note = CASE WHEN $8::boolean THEN $9 ELSE admin_note END,
         updated_at = now()
       WHERE id = $1 RETURNING id`,
      [id, p.status ?? null, p.payment_status ?? null, p.preferred_date ?? null, p.preferred_slot ?? null,
       confirmed !== undefined, confirmed ? confirmed.toISOString() : null, p.admin_note !== undefined, p.admin_note || null],
    );
    if (!row) return badRequest("That appointment no longer exists.");
    await audit(gate, "doctor_appointment.update", "doctor_appointments", id, p);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("doctor-appointments:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return badRequest("Missing appointment.");
  try {
    const row = await queryOne<{ reference: string; payment_status: string }>(
      `DELETE FROM doctor_appointments WHERE id = $1 RETURNING reference, payment_status`,
      [id],
    );
    if (!row) return badRequest("That appointment no longer exists.");
    await audit(gate, "doctor_appointment.delete", "doctor_appointments", id, row);
    return NextResponse.json({ ok: true, message: row.payment_status === "paid" ? `Deleted ${row.reference}. It was paid — refund it in Razorpay if needed.` : undefined });
  } catch (err) {
    return serverError("doctor-appointments:delete", err);
  }
}

import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { asLines } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = [
  "fulfillment_status", "payment_status", "notes",
  "courier", "tracking_ref", "delivery_note",
] as const;

/**
 * The lifecycle the console drives, in order. Each step stamps its own time
 * column so "when was this dispatched" survives the next status change, and
 * every step is journalled to order_events.
 */
const STAMP: Record<string, string> = {
  confirmed: "confirmed_at",
  dispatched: "dispatched_at",
  delivered: "delivered_at",
};

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const status = new URL(req.url).searchParams.get("status");
    const orders = await query(
      `SELECT o.*,
              COALESCE((SELECT json_agg(json_build_object(
                'status', e.status, 'note', e.note, 'courier', e.courier,
                'tracking_ref', e.tracking_ref, 'created_by', e.created_by,
                'created_at', e.created_at::text
              ) ORDER BY e.created_at DESC)
              FROM order_events e WHERE e.order_id = o.id), '[]'::json) AS events
       FROM orders o
       WHERE ($1::text IS NULL OR o.fulfillment_status = $1)
       ORDER BY o.created_at DESC LIMIT 200`,
      [status],
    );
    // Rows written before the jsonb encoding was fixed hold `items` as a JSON
    // string. Normalise here so the console never has to know that.
    return NextResponse.json({
      orders: (orders as Array<Record<string, unknown>>).map((o) => ({ ...o, items: asLines(o.items) })),
    });
  } catch (err) {
    return serverError("orders:list", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing order id.");
    const update = buildUpdate("orders", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    const rows = await query(update.text, update.params);

    // Stamp the moment this step happened, so the timeline is real rather than
    // inferred from whenever the row was last touched.
    const status = typeof body.fulfillment_status === "string" ? body.fulfillment_status : null;
    if (status && STAMP[status]) {
      await query(
        `UPDATE orders SET ${STAMP[status]} = COALESCE(${STAMP[status]}, now()) WHERE id = $1`,
        [body.id],
      ).catch(() => {});
    }

    // Journal every admin touch. The player's account reads this trail, so an
    // update here is what they see on their order.
    if (status || body.courier || body.tracking_ref || body.delivery_note) {
      await query(
        `INSERT INTO order_events (order_id, status, note, courier, tracking_ref, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          body.id,
          status ?? "updated",
          (body.delivery_note as string) ?? (body.notes as string) ?? null,
          (body.courier as string) ?? null,
          (body.tracking_ref as string) ?? null,
          gate.email,
        ],
      ).catch((err) => console.error("[orders] event log failed:", err));
    }

    await audit(gate, "order.update", "orders", String(body.id), body);
    return NextResponse.json({ ok: true, order: rows[0] ?? null });
  } catch (err) {
    return serverError("orders:update", err);
  }
}

/**
 * Delete an order. Cancelling is almost always the right move — it keeps the
 * record — so this is for test rows and duplicates only.
 */
export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing order id.");
    const rows = await query<{ order_no: string; payment_status: string }>(
      `SELECT order_no, payment_status FROM orders WHERE id = $1`,
      [id],
    );
    if (rows[0]?.payment_status === "paid") {
      return NextResponse.json(
        { error: "That order is paid. Mark it cancelled and refunded instead of deleting the record." },
        { status: 409 },
      );
    }
    await query(`DELETE FROM orders WHERE id = $1`, [id]);
    await audit(gate, "order.delete", "orders", id, { order_no: rows[0]?.order_no });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("orders:delete", err);
  }
}

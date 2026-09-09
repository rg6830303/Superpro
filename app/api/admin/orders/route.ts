import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = ["fulfillment_status", "payment_status", "notes"] as const;

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const status = new URL(req.url).searchParams.get("status");
    const orders = await query(
      `SELECT * FROM orders
       WHERE ($1::text IS NULL OR fulfillment_status = $1)
       ORDER BY created_at DESC LIMIT 200`,
      [status],
    );
    return NextResponse.json({ orders });
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

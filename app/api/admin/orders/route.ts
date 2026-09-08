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

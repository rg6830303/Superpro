import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { createRazorpayOrder, isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { OPEN } from "@/lib/sparvic-open";
import type { OpenEntry } from "@/lib/sparvic-open-server";

export const runtime = "nodejs";

const schema = z.object({ reference: z.string().regex(/^SO-[A-F0-9]{8}$/) });

/** Pay for an unpaid entry later, from the entries list. */
export async function POST(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isRazorpayEnabled) return NextResponse.json({ error: "Online payment isn't available right now." }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  try {
    await ensureSchema();
    const e = await queryOne<OpenEntry>(`SELECT * FROM open_entries WHERE reference = $1 AND user_id = $2`, [parsed.data.reference, session.id]);
    if (!e) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    if (e.payment_status === "paid") return NextResponse.json({ error: "This entry is already paid." }, { status: 409 });
    const order = await createRazorpayOrder({ amountPaise: e.amount_paise, receipt: e.reference, notes: { kind: "sparvic_open", reference: e.reference } });
    await query(`UPDATE open_entries SET razorpay_order_id = $2 WHERE id = $1`, [e.id, order.id]);
    return NextResponse.json({
      ok: true,
      reference: e.reference,
      order: { id: order.id, amount: order.amount },
      key_id: razorpayKeyId,
      prefill: { name: e.player_name, contact: e.player_phone ?? undefined, email: e.player_email ?? undefined },
      description: `${OPEN.name} · ${e.reference}${Number((e as { discount_paise?: number }).discount_paise ?? 0) > 0 ? ` · Early bird ${OPEN.earlyBirdPct}% off applied` : ""}`,
    });
  } catch (err) {
    console.error("[sparvic-open/pay]", err);
    return NextResponse.json({ error: "Could not start the payment. Please try again." }, { status: 500 });
  }
}

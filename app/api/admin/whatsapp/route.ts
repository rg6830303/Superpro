import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { postSlotToGroup } from "@/lib/games";
import { sendWhatsApp, whatsappConfig } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Outbox listing — what went out, what is still waiting for a human tap. */
export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const status = new URL(req.url).searchParams.get("status");
    const messages = await query(
      `SELECT * FROM whatsapp_outbox
       WHERE ($1::text IS NULL OR status = $1)
       ORDER BY created_at DESC LIMIT 100`,
      [status],
    );
    return NextResponse.json({ messages, config: whatsappConfig });
  } catch (err) {
    return serverError("whatsapp:list", err);
  }
}

/**
 * Actions:
 *   post_slot   — build and send the group post for one game slot
 *   broadcast   — send an arbitrary message to the group
 *   retry       — re-attempt a queued/failed outbox row
 *   mark_sent   — operator posted it by hand; close the row
 */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "post_slot") {
      if (!body.session_id) return badRequest("Missing session id.");
      const result = await postSlotToGroup(String(body.session_id));
      await audit(gate, "whatsapp.post_slot", "game_sessions", String(body.session_id));
      return NextResponse.json({ ok: result.ok, message: result.message, config: whatsappConfig });
    }

    if (action === "broadcast") {
      const message = String(body.message ?? "").trim();
      if (message.length < 3) return badRequest("Write a message first.");
      const result = await sendWhatsApp({ kind: "broadcast", target: "group", message });
      await audit(gate, "whatsapp.broadcast", undefined, undefined, { length: message.length });
      return NextResponse.json({ ok: result.status !== "failed", result, message });
    }

    if (action === "retry") {
      if (!body.id) return badRequest("Missing message id.");
      const rows = await query<{ kind: string; target: "group" | "number"; phone: string | null; message: string }>(
        `SELECT kind, target, phone, message FROM whatsapp_outbox WHERE id = $1`,
        [body.id],
      );
      if (rows.length === 0) return badRequest("No such message.");
      const result = await sendWhatsApp({
        kind: rows[0].kind,
        target: rows[0].target,
        phone: rows[0].phone,
        message: rows[0].message,
      });
      if (result.status === "sent") {
        await query(`UPDATE whatsapp_outbox SET status = 'sent', sent_at = now() WHERE id = $1`, [body.id]);
      }
      return NextResponse.json({ ok: result.status !== "failed", result });
    }

    if (action === "mark_sent") {
      if (!body.id) return badRequest("Missing message id.");
      await query(`UPDATE whatsapp_outbox SET status = 'sent', channel = 'manual', sent_at = now() WHERE id = $1`, [
        body.id,
      ]);
      await audit(gate, "whatsapp.mark_sent", "whatsapp_outbox", String(body.id));
      return NextResponse.json({ ok: true });
    }

    return badRequest("Unknown action.");
  } catch (err) {
    return serverError("whatsapp:action", err);
  }
}

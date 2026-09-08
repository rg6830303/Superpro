import { query } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { SITE, WHATSAPP_NUMBER } from "@/lib/site";

/**
 * WhatsApp delivery.
 *
 * IMPORTANT — a note on groups: Meta's official WhatsApp Cloud API cannot post
 * into a group chat. It only sends to individual numbers. So "confirmed slots
 * posted to the group" is delivered in three tiers, best available first:
 *
 *   1. WHATSAPP_WEBHOOK_URL — a relay you control (n8n / Make / a whatsapp-web.js
 *      bridge). It receives { group_jid, message } and posts to the group. This
 *      is the only way to post to a group automatically.
 *   2. WHATSAPP_CLOUD_TOKEN + WHATSAPP_PHONE_NUMBER_ID — Cloud API. Used for
 *      direct-to-player confirmations; group posts fall through to tier 3.
 *   3. Manual — the message is queued in `whatsapp_outbox` and the admin console
 *      shows a one-tap "Post to group" button that opens WhatsApp with the text
 *      pre-filled. Nothing is ever lost; it just needs one human tap.
 *
 * Every attempt, successful or not, is recorded in `whatsapp_outbox` so the
 * admin console always shows exactly what went out and what is still pending.
 */

const WEBHOOK_URL = process.env.WHATSAPP_WEBHOOK_URL ?? "";
const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET ?? "";
const CLOUD_TOKEN = process.env.WHATSAPP_CLOUD_TOKEN ?? "";
const CLOUD_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
const GROUP_JID = process.env.WHATSAPP_GROUP_JID ?? "";

export type OutboxTarget = "group" | "number";

export type QueueArgs = {
  kind: string;
  target: OutboxTarget;
  message: string;
  phone?: string | null;
  refTable?: string | null;
  refId?: string | null;
};

export type SendResult = {
  status: "sent" | "queued" | "failed";
  channel: "webhook" | "cloud-api" | "manual";
  error?: string;
};

/** Web link that opens WhatsApp with the message pre-filled (manual fallback). */
export function shareLink(message: string, phone?: string): string {
  const base = phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}

async function viaWebhook(target: OutboxTarget, message: string, phone?: string | null) {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(WEBHOOK_SECRET ? { authorization: `Bearer ${WEBHOOK_SECRET}` } : {}),
    },
    body: JSON.stringify({
      target,
      group_jid: target === "group" ? GROUP_JID : undefined,
      phone: target === "number" ? phone : undefined,
      message,
      source: "superpro-web",
    }),
  });
  if (!res.ok) throw new Error(`relay responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function viaCloudApi(phone: string, message: string) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${CLOUD_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${CLOUD_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone.replace(/\D/g, ""),
      type: "text",
      text: { preview_url: false, body: message },
    }),
  });
  if (!res.ok) throw new Error(`cloud api ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/**
 * Queue a message and attempt delivery. Never throws — a WhatsApp outage must
 * not roll back a paid booking.
 */
export async function sendWhatsApp(args: QueueArgs): Promise<SendResult> {
  const { kind, target, message, phone = null, refTable = null, refId = null } = args;
  let result: SendResult = { status: "queued", channel: "manual" };

  try {
    if (WEBHOOK_URL) {
      await viaWebhook(target, message, phone);
      result = { status: "sent", channel: "webhook" };
    } else if (target === "number" && CLOUD_TOKEN && CLOUD_PHONE_ID && phone) {
      await viaCloudApi(phone, message);
      result = { status: "sent", channel: "cloud-api" };
    }
  } catch (err) {
    result = {
      status: "failed",
      channel: WEBHOOK_URL ? "webhook" : "cloud-api",
      error: err instanceof Error ? err.message : String(err),
    };
    console.error("[whatsapp] delivery failed:", result.error);
  }

  try {
    await query(
      `INSERT INTO whatsapp_outbox (kind, target, phone, message, status, channel, error, ref_table, ref_id, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        kind,
        target,
        phone,
        message,
        result.status,
        result.channel,
        result.error ?? null,
        refTable,
        refId,
        result.status === "sent" ? new Date().toISOString() : null,
      ],
    );
  } catch (err) {
    console.error("[whatsapp] outbox write failed:", err instanceof Error ? err.message : err);
  }

  return result;
}

// ── Message templates ───────────────────────────────────────────────────────

export type SlotPost = {
  date: string; // already formatted, e.g. "Mon, 14 Sep"
  time: string;
  venue: string;
  court: number | null;
  players: Array<{ name: string; level?: string | null }>;
};

/** The daily-games group post: date, time, court, and every confirmed name. */
export function slotConfirmationMessage(post: SlotPost): string {
  const lines = [
    `🏓 *SUPERPRO — CONFIRMED SLOT*`,
    ``,
    `📅 ${post.date}`,
    `⏰ ${post.time}`,
    `📍 ${post.venue}${post.court ? ` · Court ${post.court}` : ""}`,
    ``,
    `*Players (${post.players.length})*`,
    ...post.players.map((p, i) => `${i + 1}. ${p.name}${p.level ? ` (${p.level})` : ""}`),
    ``,
    `Reach 10 minutes early. Balls and spare paddles on court.`,
    `— Team ${SITE.name}`,
  ];
  return lines.join("\n");
}

export function bookingReceiptMessage(args: {
  name: string;
  ref: string;
  lines: string[];
  totalPaise: number;
  payMethod: string;
}): string {
  return [
    `🏓 *SUPERPRO — BOOKING CONFIRMED*`,
    ``,
    `Hi ${args.name}, you're in.`,
    `Ref: *${args.ref}*`,
    ``,
    ...args.lines.map((l) => `• ${l}`),
    ``,
    `Amount: *${formatPaise(args.totalPaise)}* (${args.payMethod})`,
    ``,
    `Questions? Reply here or call us on +${WHATSAPP_NUMBER}.`,
  ].join("\n");
}

export function orderReceiptMessage(args: {
  name: string;
  orderNo: string;
  items: Array<{ name: string; qty: number }>;
  totalPaise: number;
  mode: string;
}): string {
  return [
    `🏓 *SUPERPRO — ORDER ${args.orderNo}*`,
    ``,
    `Thanks ${args.name}! We've got your order.`,
    ``,
    ...args.items.map((i) => `• ${i.qty} × ${i.name}`),
    ``,
    `Total: *${formatPaise(args.totalPaise)}*`,
    `Fulfilment: ${args.mode === "pickup" ? "Pickup at the court" : "Delivery in Kolkata"}`,
    ``,
    `We'll message you the moment it's ready.`,
  ].join("\n");
}

export function coachingRequestMessage(args: {
  name: string;
  coach: string;
  when: string;
  sessions: number;
  ref: string;
}): string {
  return [
    `🎾 *SUPERPRO — COACHING REQUEST*`,
    ``,
    `Player: ${args.name}`,
    `Coach: *${args.coach}*`,
    `Preferred: ${args.when}`,
    `Sessions: ${args.sessions}`,
    `Ref: ${args.ref}`,
    ``,
    `Coach will confirm on WhatsApp shortly.`,
  ].join("\n");
}

export function tournamentGroupMessage(args: {
  tournament: string;
  groups: Array<{ name: string; court: number | null; teams: string[] }>;
}): string {
  const lines = [`🏆 *${args.tournament.toUpperCase()} — GROUPS*`, ``];
  for (const g of args.groups) {
    lines.push(`*${g.name}*${g.court ? ` · Court ${g.court}` : ""}`);
    g.teams.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
    lines.push(``);
  }
  lines.push(`Report 30 minutes before your first match. — Team ${SITE.name}`);
  return lines.join("\n");
}

export const whatsappConfig = {
  hasRelay: Boolean(WEBHOOK_URL),
  hasCloudApi: Boolean(CLOUD_TOKEN && CLOUD_PHONE_ID),
  hasGroupJid: Boolean(GROUP_JID),
};

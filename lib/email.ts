/**
 * Transactional email through Resend's REST API — one fetch, no SDK.
 *
 * Configure in Vercel (and .env.local):
 *   RESEND_API_KEY  — from resend.com → API Keys
 *   RESEND_FROM     — a sender on a domain verified in Resend,
 *                     e.g. "Sparvic <no-reply@sparvic.com>"
 *
 * Without a key nothing is sent: the caller gets { ok: false, reason:
 * "not-configured" } and decides what to do (the reset flow logs the link in
 * development so it can still be tested end to end).
 */

export const isEmailConfigured = Boolean(process.env.RESEND_API_KEY?.trim());

const FROM = process.env.RESEND_FROM?.trim() || "Sparvic <no-reply@sparvic.com>";

export type SendResult = { ok: true; id: string } | { ok: false; reason: "not-configured" | "failed"; detail?: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, reason: "not-configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !data.id) {
      console.error("[email] resend rejected:", res.status, data.message ?? "");
      return { ok: false, reason: "failed", detail: data.message };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("[email] resend unreachable:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "failed" };
  }
}

/** Minimal escaping for values dropped into the HTML templates. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

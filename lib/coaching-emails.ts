import { sendEmail, escapeHtml } from "@/lib/email";
import { PROGRAM, COACH, venueById, formatRupees } from "@/lib/coaching-program";
import type { Registration } from "@/lib/coaching-registrations";

/** Confirmation email after registering and again after paying. Best effort: never blocks the flow. */
export async function sendRegistrationEmail(reg: Registration, origin: string, kind: "registered" | "paid"): Promise<void> {
  if (!reg.email) return;
  const venue = venueById(reg.pay_venue);
  const statusUrl = `${origin}/coaching/registration/${reg.reference}`;
  const first = escapeHtml(reg.name.trim().split(/\s+/)[0] || "there");
  const paid = kind === "paid";
  const amount = formatRupees(reg.amount_paise / 100);
  const headline = paid ? "Payment received — you're in!" : "You're registered!";
  const lead = paid
    ? `We've received ${amount} for the ${escapeHtml(reg.batch)} batch at ${escapeHtml(venue?.name ?? reg.pay_venue)}. Coach ${COACH.name} will confirm your group, days and timing on WhatsApp.`
    : `Thanks for registering for the ${escapeHtml(reg.batch)} batch. We'll group you with players at the same level (minimum ${PROGRAM.minGroupSize}). Your slot is confirmed once payment is done.`;

  const rows = [
    ["Reference", reg.reference],
    ["Batch", reg.batch],
    ["Venue", venue ? `${venue.name}, ${venue.area}` : reg.pay_venue],
    ["Fee", `${amount} / month · ${PROGRAM.classesPerMonth} classes`],
    ["Payment", paid ? "Paid" : "Pending"],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#7a8b97;font-size:13px;width:110px">${k}</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#06263d">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#eef2f5;font-family:'Helvetica Neue',Arial,sans-serif;color:#06263d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="background:#05223c;padding:30px 28px;text-align:center">
<img src="${origin}/logo/sparvic-logo-white.png" alt="Sparvic" width="130" style="display:inline-block;width:130px;height:auto;border:0">
<p style="margin:14px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#dee672">${PROGRAM.name}</p>
</td></tr>
<tr><td style="height:4px;background:#1fdc6c;font-size:0;line-height:4px">&nbsp;</td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 12px;font-size:23px;font-weight:800">${headline}</h1>
<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3d5566">Hi ${first},</p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#3d5566">${lead}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5ecef;border-bottom:1px solid #e5ecef;margin-bottom:24px">${rows}</table>
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px"><tr><td style="border-radius:999px;background:#1fdc6c">
<a href="${statusUrl}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#06263d;text-decoration:none">${paid ? "View my registration" : "Pay & confirm my slot"}</a>
</td></tr></table>
<p style="margin:0;font-size:13px;color:#7a8b97">Questions? Call or WhatsApp ${PROGRAM.phoneDisplay}.</p>
</td></tr>
<tr><td style="background:#05223c;padding:18px;text-align:center;font-size:11px;color:#8fa6b6">© ${new Date().getFullYear()} Sparvic Sports · Kolkata</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Hi ${reg.name.split(" ")[0]},`,
    "",
    paid ? `Payment received — ${amount} for the ${reg.batch} batch.` : `You're registered for the ${reg.batch} batch.`,
    `Reference: ${reg.reference}`,
    `Venue: ${venue?.name ?? reg.pay_venue}`,
    paid ? "Coach will confirm your group and timing on WhatsApp." : "Your slot is confirmed once payment is done.",
    statusUrl,
    "",
    `Questions? ${PROGRAM.phoneDisplay}`,
  ].join("\n");

  await sendEmail({
    to: reg.email,
    subject: paid ? `Payment received · ${PROGRAM.name} (${reg.reference})` : `Registration received · ${PROGRAM.name} (${reg.reference})`,
    html,
    text,
  }).catch(() => {});
}

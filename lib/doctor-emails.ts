import { sendEmail, escapeHtml } from "@/lib/email";
import { DOCTOR, type Appointment } from "@/lib/doctor";

const day = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

/** Booking / payment confirmation. Best effort — never blocks the flow. */
export async function sendAppointmentEmail(a: Appointment, origin: string, kind: "booked" | "paid"): Promise<void> {
  if (!a.email) return;
  const paid = kind === "paid";
  const link = `${origin}/medical/appointment/${a.reference}`;
  const first = escapeHtml(a.name.trim().split(/\s+/)[0] || "there");
  const rows = [
    ["Reference", a.reference],
    ["Consultation", `Clinic visit with ${DOCTOR.handle} (${DOCTOR.name})`],
    ["Preferred", `${day(a.preferred_date)} · ${a.preferred_slot}`],
    ["Concern", a.concern],
    ["Fee", `₹${(a.amount_paise / 100).toLocaleString("en-IN")} · ${paid ? "Paid" : "Pending"}`],
  ]
    .map(([k, v]) => `<tr><td style="padding:8px 0;color:#7a8b97;font-size:13px;width:115px">${k}</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#06263d">${escapeHtml(v)}</td></tr>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#eef2f5;font-family:'Helvetica Neue',Arial,sans-serif;color:#06263d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="background:#05223c;padding:30px;text-align:center"><img src="${origin}/logo/sparvic-logo-white.png" alt="Sparvic" width="130" style="display:inline-block;width:130px;height:auto;border:0">
<p style="margin:14px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#dee672">Medical assistance</p></td></tr>
<tr><td style="height:4px;background:#1fdc6c;font-size:0;line-height:4px">&nbsp;</td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 12px;font-size:23px;font-weight:800">${paid ? "Consultation booked — payment received" : "Consultation requested"}</h1>
<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3d5566">Hi ${first},</p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#3d5566">${
    paid
      ? `${DOCTOR.handle} will confirm your exact appointment time and the clinic location on WhatsApp.`
      : `Your request is saved. Complete the ₹${DOCTOR.fee} payment to confirm it — ${DOCTOR.handle} will then confirm your time on WhatsApp.`
  }</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5ecef;border-bottom:1px solid #e5ecef;margin-bottom:24px">${rows}</table>
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px"><tr><td style="border-radius:999px;background:#1fdc6c">
<a href="${link}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#06263d;text-decoration:none">${paid ? "View my appointment" : `Pay ₹${DOCTOR.fee} & confirm`}</a></td></tr></table>
<p style="margin:0;font-size:13px;color:#7a8b97">Questions? Call or WhatsApp ${DOCTOR.phoneDisplay}. In an emergency, call 112.</p>
</td></tr><tr><td style="background:#05223c;padding:18px;text-align:center;font-size:11px;color:#8fa6b6">© ${new Date().getFullYear()} Sparvic Sports · Kolkata</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    `Hi ${a.name.split(" ")[0]},`,
    paid ? "Your consultation is booked and paid." : `Your consultation request is saved — pay ₹${DOCTOR.fee} to confirm.`,
    `Reference: ${a.reference}`,
    `Preferred: ${day(a.preferred_date)}, ${a.preferred_slot}`,
    `${DOCTOR.handle} will confirm the time and clinic location on WhatsApp.`,
    link,
  ].join("\n");
  await sendEmail({
    to: a.email,
    subject: paid ? `Consultation booked · ${a.reference}` : `Consultation requested · ${a.reference}`,
    html,
    text,
  }).catch(() => {});
}

import { escapeHtml, sendEmail } from "@/lib/email";
import { SITE } from "@/lib/site";
import { OPEN } from "@/lib/sparvic-open";

type Person = { full_name: string; email: string } | null;
type Kind = "pair_request" | "pair_accepted" | "pair_declined" | "entry_confirmed" | "team_confirmed";

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

function layout(title: string, intro: string, rows: Array<[string, string]>, cta: { label: string; href: string } | null, note?: string) {
  const origin = SITE.url;
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:8px 0;color:#6f7f78;font-size:13px;width:130px;vertical-align:top">${escapeHtml(k)}</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#193d32">${escapeHtml(v)}</td></tr>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#eef3ea;font-family:'Helvetica Neue',Arial,sans-serif;color:#193d32">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#1d1747;padding:28px;text-align:center">
<img src="${origin}/logo/sparvic-logo-on-dark.png" alt="Sparvic" width="130" style="display:inline-block;width:130px;height:auto;border:0">
<p style="margin:14px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#cfc3ff">${escapeHtml(OPEN.name)}</p></td></tr>
<tr><td style="height:4px;background:#d9ef75;font-size:0;line-height:4px">&nbsp;</td></tr>
<tr><td style="padding:30px">
<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#193d32">${escapeHtml(title)}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3d5249">${intro}</p>
${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3eadf;border-bottom:1px solid #e3eadf;margin-bottom:22px">${table}</table>` : ""}
${cta ? `<a href="${cta.href}" style="display:inline-block;background:#1a563f;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:12px">${escapeHtml(cta.label)}</a>` : ""}
${note ? `<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6f7f78">${note}</p>` : ""}
<p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#6f7f78">Warm regards,<br><strong style="color:#193d32">Team Sparvic</strong><br>${escapeHtml(OPEN.dates)} · ${escapeHtml(OPEN.venue)} · ${escapeHtml(OPEN.contactDisplay)}</p>
</td></tr>
<tr><td style="background:#f5f8f2;padding:16px 30px;font-size:11px;color:#8a9a92">You're receiving this because you have a Sparvic account. ${escapeHtml(SITE.legalName)}, Kolkata.</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Official Sparvic Open emails. Best effort: a mail failure never blocks the
 * pairing or payment it describes (the in-app notification still lands).
 */
export async function sendOpenEmail(
  kind: Kind,
  to: Person,
  d: { other?: Person; category?: string; categories?: string[]; message?: string | null; entry?: { reference: string; amount_paise: number; discount_paise?: number } },
): Promise<void> {
  if (!to?.email) return;
  const first = escapeHtml(to.full_name.trim().split(/\s+/)[0] || "there");
  const other = escapeHtml(d.other?.full_name ?? "A Sparvic player");
  const tab = `${SITE.url}/dashboard/sparvic-open`;
  let subject = "";
  let html = "";
  if (kind === "pair_request") {
    subject = `Doubles partner request: ${d.category} · ${OPEN.name}`;
    html = layout(
      "You have a doubles partner request",
      `Dear ${first},<br><br>${other} would like to partner with you in the <strong>${escapeHtml(d.category ?? "")}</strong> category of the ${escapeHtml(OPEN.name)}. Please review the request in your Sparvic clubhouse and accept or decline it. Once accepted, either of you can complete the team registration and payment.`,
      [["Category", d.category ?? ""], ["Requested by", d.other?.full_name ?? ""], ...(d.message ? [["Message", d.message] as [string, string]] : [])],
      { label: "Review the request", href: tab },
      "Partner requests are subject to the published DUPR bands. Registration is confirmed only after payment.",
    );
  } else if (kind === "pair_accepted") {
    subject = `Partner request accepted: ${d.category} · ${OPEN.name}`;
    html = layout(
      "Your partner request was accepted",
      `Dear ${first},<br><br>${other} has accepted your request to partner in <strong>${escapeHtml(d.category ?? "")}</strong>. Your team can now be registered: whichever of you pays the team entry fee confirms the team for both.`,
      [["Category", d.category ?? ""], ["Partner", d.other?.full_name ?? ""]],
      { label: "Register the team", href: tab },
      "Tip: follow your partner on Sparvic to see when they are on court.",
    );
  } else if (kind === "pair_declined") {
    subject = `Partner request update: ${d.category} · ${OPEN.name}`;
    html = layout(
      "Your partner request was declined",
      `Dear ${first},<br><br>${other} isn't able to partner with you in <strong>${escapeHtml(d.category ?? "")}</strong> this time. You can send a request to another eligible Sparvic player from the tournament tab.`,
      [["Category", d.category ?? ""]],
      { label: "Find another partner", href: tab },
    );
  } else if (kind === "entry_confirmed" && d.entry) {
    subject = `Registration confirmed · ${OPEN.name} (${d.entry.reference})`;
    html = layout(
      "Your registration is confirmed",
      `Dear ${first},<br><br>Thank you. We've received your payment and your entry in the ${escapeHtml(OPEN.name)} is confirmed. Fixtures and timings will be shared on Sparvic.`,
      [
        ["Entry", d.entry.reference],
        ["Categories", (d.categories ?? []).join(", ")],
        ...(d.entry.discount_paise ? [["Early-bird saving", fmt(d.entry.discount_paise)] as [string, string]] : []),
        ["Amount paid", fmt(d.entry.amount_paise)],
      ],
      { label: "View your entry", href: `${SITE.url}/dashboard/sparvic-open/confirmation/${d.entry.reference}` },
    );
  } else if (kind === "team_confirmed" && d.entry) {
    subject = `Your team is confirmed: ${d.category} · ${OPEN.name}`;
    html = layout(
      "Your doubles team is confirmed",
      `Dear ${first},<br><br>${other} has completed the team registration and payment for <strong>${escapeHtml(d.category ?? "")}</strong>. You are confirmed in the ${escapeHtml(OPEN.name)}.`,
      [["Category", d.category ?? ""], ["Partner", d.other?.full_name ?? ""], ["Team entry", d.entry.reference]],
      { label: "Open the tournament tab", href: tab },
    );
  } else return;
  await sendEmail({ to: to.email, subject, html, text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }).catch(() => {});
}

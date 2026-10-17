import { escapeHtml, sendEmail } from "@/lib/email";
import { queryOne } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { SITE } from "@/lib/site";
import { OPEN, OPEN_CATEGORIES, type EntryInput } from "@/lib/sparvic-open";

/**
 * Branded payment emails: a confirmation and a separate invoice, both sent
 * through Resend (lib/email) with the Sparvic logo. Used after a Sparvic Open
 * entry is paid and after a wallet recharge is credited.
 *
 * Best effort throughout: a mail failure is logged and never undoes the
 * payment it describes. Callers only reach these after the guarded
 * pending → paid UPDATE, so each payment mails once.
 *
 * Optional env: SPARVIC_GSTIN and SPARVIC_ADDRESS print on the invoice.
 */

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const LOGO = () => `${SITE.url}/logo/sparvic-logo-on-dark.png`;
const GSTIN = process.env.SPARVIC_GSTIN?.trim() || "";
const ADDRESS = process.env.SPARVIC_ADDRESS?.trim() || `${SITE.city}, West Bengal, India`;

const istDate = (d: Date | string) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

type Party = { name: string; email: string; phone?: string | null };
type Line = { description: string; detail?: string; amountPaise: number };

function shell(kicker: string, body: string): string {
  return `<!doctype html><html><head><meta name="color-scheme" content="light only"></head><body style="margin:0;background:#eef3ea;font-family:'Helvetica Neue',Arial,sans-serif;color:#193d32">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#1d1747;padding:28px;text-align:center">
<img src="${LOGO()}" alt="Sparvic" width="140" style="display:inline-block;width:140px;height:auto;border:0">
<p style="margin:14px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#cfc3ff">${escapeHtml(kicker)}</p></td></tr>
<tr><td style="height:4px;background:#d9ef75;font-size:0;line-height:4px">&nbsp;</td></tr>
<tr><td style="padding:30px">${body}</td></tr>
<tr><td style="background:#f5f8f2;padding:16px 30px;font-size:11px;line-height:1.6;color:#8a9a92">${escapeHtml(SITE.legalName)} · ${escapeHtml(ADDRESS)} · ${escapeHtml(SITE.email)}<br>You're receiving this because you made a payment on your Sparvic account.</td></tr>
</table></td></tr></table></body></html>`;
}

const rowsTable = (rows: Array<[string, string]>) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3eadf;border-bottom:1px solid #e3eadf;margin-bottom:22px">${rows
    .map(([k, v]) => `<tr><td style="padding:8px 0;color:#6f7f78;font-size:13px;width:150px;vertical-align:top">${escapeHtml(k)}</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#193d32">${escapeHtml(v)}</td></tr>`)
    .join("")}</table>`;

const button = (label: string, href: string) =>
  `<a href="${href}" style="display:inline-block;background:#1a563f;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:12px">${escapeHtml(label)}</a>`;

const plain = (html: string) => html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();

function confirmationHtml(kicker: string, title: string, intro: string, rows: Array<[string, string]>, cta: { label: string; href: string }, note?: string) {
  return shell(
    kicker,
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#193d32">${escapeHtml(title)}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3d5249">${intro}</p>
${rowsTable(rows)}
${button(cta.label, cta.href)}
${note ? `<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6f7f78">${note}</p>` : ""}
<p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#6f7f78">Warm regards,<br><strong style="color:#193d32">Team Sparvic</strong></p>`,
  );
}

/** A paid invoice: issuer, billed-to, line items, discount, total, payment details. */
function invoiceHtml(inv: {
  kicker: string;
  number: string;
  date: Date | string;
  to: Party;
  lines: Line[];
  discount?: { label: string; paise: number };
  totalPaise: number;
  method: string;
  transaction?: string | null;
  reference: string;
}) {
  const sub = inv.lines.reduce((s, l) => s + l.amountPaise, 0);
  const items = inv.lines
    .map(
      (l, i) => `<tr>
<td style="padding:10px 8px 10px 0;border-bottom:1px solid #eef2ec;font-size:13px;color:#6f7f78;vertical-align:top;width:22px">${i + 1}</td>
<td style="padding:10px 8px;border-bottom:1px solid #eef2ec;font-size:14px;color:#193d32;vertical-align:top"><strong>${escapeHtml(l.description)}</strong>${l.detail ? `<br><span style="font-size:12px;color:#6f7f78">${escapeHtml(l.detail)}</span>` : ""}</td>
<td style="padding:10px 0 10px 8px;border-bottom:1px solid #eef2ec;font-size:14px;color:#193d32;text-align:right;white-space:nowrap;vertical-align:top">${inr(l.amountPaise)}</td></tr>`,
    )
    .join("");
  const total = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:6px 0;font-size:${strong ? 15 : 13}px;color:${strong ? "#193d32" : "#6f7f78"};${strong ? "font-weight:800;" : ""}text-align:right">${escapeHtml(label)}</td><td style="padding:6px 0 6px 18px;font-size:${strong ? 16 : 14}px;font-weight:${strong ? 800 : 600};color:#193d32;text-align:right;white-space:nowrap;width:120px">${value}</td></tr>`;

  return shell(
    inv.kicker,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top"><p style="margin:0;font-size:24px;font-weight:800;letter-spacing:1px;color:#193d32">INVOICE</p>
<p style="margin:4px 0 0;font-size:13px;color:#6f7f78">${escapeHtml(inv.number)}</p></td>
<td style="vertical-align:top;text-align:right"><span style="display:inline-block;background:#e3f4d0;color:#1a563f;font-size:12px;font-weight:800;letter-spacing:2px;padding:6px 12px;border-radius:999px">PAID</span>
<p style="margin:8px 0 0;font-size:12px;color:#6f7f78">${escapeHtml(istDate(inv.date))} IST</p></td></tr></table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;background:#f5f8f2;border-radius:14px"><tr>
<td style="padding:16px;vertical-align:top;width:50%"><p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a9a92">From</p>
<p style="margin:0;font-size:14px;font-weight:700;color:#193d32">${escapeHtml(SITE.legalName)}</p>
<p style="margin:2px 0 0;font-size:12px;line-height:1.5;color:#6f7f78">${escapeHtml(ADDRESS)}<br>${escapeHtml(SITE.email)}${GSTIN ? `<br>GSTIN ${escapeHtml(GSTIN)}` : ""}</p></td>
<td style="padding:16px;vertical-align:top;width:50%"><p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a9a92">Billed to</p>
<p style="margin:0;font-size:14px;font-weight:700;color:#193d32">${escapeHtml(inv.to.name)}</p>
<p style="margin:2px 0 0;font-size:12px;line-height:1.5;color:#6f7f78">${escapeHtml(inv.to.email)}${inv.to.phone ? `<br>+91 ${escapeHtml(inv.to.phone)}` : ""}</p></td></tr></table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><th style="padding:0 8px 8px 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8a9a92;text-align:left;border-bottom:2px solid #193d32">#</th>
<th style="padding:0 8px 8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8a9a92;text-align:left;border-bottom:2px solid #193d32">Description</th>
<th style="padding:0 0 8px 8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8a9a92;text-align:right;border-bottom:2px solid #193d32">Amount</th></tr>
${items}</table>

<table role="presentation" cellpadding="0" cellspacing="0" align="right" style="margin:14px 0 22px">
${total("Subtotal", inr(sub))}
${inv.discount && inv.discount.paise > 0 ? total(inv.discount.label, `− ${inr(inv.discount.paise)}`) : ""}
${total("Total paid", inr(inv.totalPaise), true)}
</table><div style="clear:both"></div>

${rowsTable([
  ["Payment method", inv.method],
  ...(inv.transaction ? [["Transaction ID", inv.transaction] as [string, string]] : []),
  ["Reference", inv.reference],
])}
<p style="margin:0;font-size:12px;line-height:1.6;color:#8a9a92">This is a computer-generated invoice and needs no signature. Prices are inclusive of applicable taxes. Questions: ${escapeHtml(SITE.email)}${OPEN.contactDisplay ? ` · ${escapeHtml(OPEN.contactDisplay)}` : ""}.</p>`,
  );
}

async function mail(to: string, subject: string, html: string, tag: string) {
  const r = await sendEmail({ to, subject, html, text: plain(html) }).catch(() => ({ ok: false as const, reason: "failed" as const }));
  if (!r.ok) console.error(`[receipts] ${tag} email not sent to ${to}:`, r.reason);
}

/* ─────────────────────────── Sparvic Open ─────────────────────────── */

type PaidEntry = {
  reference: string;
  amount_paise: number;
  discount_paise?: number | null;
  categories: EntryInput[];
  razorpay_payment_id?: string | null;
  paid_at?: string | null;
  created_at: string;
};

function paymentMethod(id: string | null | undefined): { method: string; transaction: string | null } {
  if (!id) return { method: "Online", transaction: null };
  if (id === "wallet") return { method: "Sparvic Wallet", transaction: null };
  if (id.startsWith("manual:")) return { method: "Paid at the Sparvic desk", transaction: null };
  return { method: "Online (Razorpay)", transaction: id };
}

/** The invoice for a paid Sparvic Open entry, mailed to the player who paid. */
export async function sendTournamentInvoice(entry: PaidEntry, payer: Party): Promise<void> {
  if (!payer.email) return;
  const lines: Line[] = entry.categories.map((c) => {
    const cat = OPEN_CATEGORIES.find((x) => x.id === c.category);
    return {
      description: `${OPEN.name}: ${cat?.label ?? c.category}`,
      detail: cat?.type === "doubles" ? `Team entry${c.partner_name ? ` · partner ${c.partner_name}` : ""}` : "Singles entry",
      amountPaise: cat?.feePaise ?? 0,
    };
  });
  const pm = paymentMethod(entry.razorpay_payment_id);
  const html = invoiceHtml({
    kicker: OPEN.name,
    number: `INV-${entry.reference}`,
    date: entry.paid_at ?? entry.created_at,
    to: payer,
    lines,
    discount: { label: `Early-bird ${OPEN.earlyBirdPct}% off`, paise: Number(entry.discount_paise ?? 0) },
    totalPaise: entry.amount_paise,
    method: pm.method,
    transaction: pm.transaction,
    reference: entry.reference,
  });
  await mail(payer.email, `Invoice INV-${entry.reference} · ${OPEN.name}`, html, "tournament invoice");
}

/* ─────────────────────────── Wallet recharge ─────────────────────────── */

/**
 * Everything after a wallet recharge lands: an in-app (and browser)
 * notification, a confirmation email and an invoice email.
 */
export async function afterWalletRecharge(r: {
  userId: string;
  amountPaise: number;
  balancePaise: number | null;
  reference: string;
  paymentId?: string | null;
  /** "online" for Razorpay; "venue" for a rep loading it at the desk. */
  via: "online" | "venue";
  at?: Date | string;
}): Promise<void> {
  const amount = inr(r.amountPaise);
  const balance = r.balancePaise != null ? inr(r.balancePaise) : null;
  await createNotification({
    userId: r.userId,
    kind: "system",
    title: `Wallet recharged: ${amount}`,
    message: `${amount} added to your Sparvic Wallet${balance ? `. Balance ${balance}` : ""}. Ref ${r.reference}.`,
    linkUrl: "/dashboard/wallet",
  }).catch(() => {});

  const user = await queryOne<{ full_name: string; email: string; phone: string | null }>(
    `SELECT full_name, email, phone FROM users WHERE id = $1`,
    [r.userId],
  ).catch(() => null);
  if (!user?.email) return;

  const first = escapeHtml(user.full_name.trim().split(/\s+/)[0] || "there");
  const method = r.via === "online" ? "Online (Razorpay)" : "Paid at the Sparvic desk";
  const when = r.at ?? new Date();
  const invoiceNo = `INV-${r.reference}`;

  await mail(
    user.email,
    `Wallet recharge successful: ${amount} (${r.reference})`,
    confirmationHtml(
      "Sparvic Wallet",
      "Your wallet has been recharged",
      `Dear ${first},<br><br>Thank you. We've received your payment and ${amount} has been added to your Sparvic Wallet. Use it for daily games, coaching, tournaments and the shop. Your invoice follows in a separate email.`,
      [
        ["Amount added", amount],
        ...(balance ? [["New balance", balance] as [string, string]] : []),
        ["Payment method", method],
        ...(r.paymentId && r.via === "online" ? [["Transaction ID", r.paymentId] as [string, string]] : []),
        ["Reference", r.reference],
        ["Date", `${istDate(when)} IST`],
      ],
      { label: "Open my wallet", href: `${SITE.url}/dashboard/wallet` },
    ),
    "wallet confirmation",
  );

  await mail(
    user.email,
    `Invoice ${invoiceNo} · Sparvic Wallet recharge`,
    invoiceHtml({
      kicker: "Sparvic Wallet",
      number: invoiceNo,
      date: when,
      to: { name: user.full_name, email: user.email, phone: user.phone },
      lines: [{ description: "Sparvic Wallet recharge", detail: "Prepaid credit for games, coaching, tournaments and the shop", amountPaise: r.amountPaise }],
      totalPaise: r.amountPaise,
      method,
      transaction: r.via === "online" ? r.paymentId : null,
      reference: r.reference,
    }),
    "wallet invoice",
  );
}

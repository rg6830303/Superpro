import { createHash, randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { getUserRowByEmail } from "@/lib/accounts";
import { sendEmail, escapeHtml, isEmailConfigured } from "@/lib/email";
import { supabaseAdmin, isSupabaseAdminConfigured, findAuthUserByEmail } from "@/lib/supabase";
import { SITE, WHATSAPP_NUMBER } from "@/lib/site";

/** How long a reset link stays valid. */
const TTL_MINUTES = 60;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export type ResetRequestResult = "sent" | "not_registered" | "send_failed";

/**
 * Start a reset — only for a player who is genuinely registered: a row in
 * `users` AND the matching Supabase Auth account. Admin and staff accounts are
 * excluded so the console password can never be changed from the public site.
 */
export async function requestPasswordReset(email: string, origin: string): Promise<ResetRequestResult> {
  await ensureSchema();
  const user = await getUserRowByEmail(email);
  if (!user || user.role === "admin" || user.role === "staff") return "not_registered";
  const authUser = await findAuthUserByEmail(user.email);
  if (!authUser || authUser.id !== user.id) return "not_registered";

  const token = randomBytes(32).toString("base64url");
  // One live link per account: a new request retires the older ones.
  await query(`UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [user.id]);
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [user.id, hash(token), TTL_MINUTES],
  );

  const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const first = (user.full_name ?? "").trim().split(/\s+/)[0] || "there";

  const sent = await sendEmail({
    to: user.email,
    subject: "Reset your Sparvic password",
    text: [
      `Hi ${first},`,
      "",
      `We received a request to reset the password for your Sparvic account (${user.email}).`,
      "",
      `Choose a new password here. The link works once and expires in ${TTL_MINUTES} minutes:`,
      link,
      "",
      "Didn't ask for this? You can safely ignore this email. Your password won't change.",
      "",
      "See you on court,",
      "Team Sparvic",
      origin,
    ].join("\n"),
    html: resetEmailHtml(escapeHtml(first), escapeHtml(user.email), link, origin),
  });
  if (sent.ok) return "sent";

  if (!isEmailConfigured && !process.env.VERCEL) {
    // Local testing only (never on Vercel), before the Resend key is wired in.
    console.log(`[password-reset] email not configured — reset link for ${user.email}: ${link}`);
    return "sent";
  }
  // Nothing was delivered: retire the link so it cannot linger unused.
  await query(`UPDATE password_resets SET used_at = now() WHERE token_hash = $1`, [hash(token)]);
  return "send_failed";
}

export type ResetCheck = { ok: true; userId: string } | { ok: false; error: string };

export async function checkResetToken(token: string): Promise<ResetCheck> {
  if (!token || token.length < 20) return { ok: false, error: "This reset link is not valid." };
  await ensureSchema();
  const row = await queryOne<{ user_id: string; expired: boolean; used: boolean }>(
    `SELECT user_id, expires_at < now() AS expired, used_at IS NOT NULL AS used
     FROM password_resets WHERE token_hash = $1`,
    [hash(token)],
  );
  if (!row) return { ok: false, error: "This reset link is not valid." };
  if (row.used) return { ok: false, error: "This reset link has already been used. Request a new one." };
  if (row.expired) return { ok: false, error: "This reset link has expired. Request a new one." };
  return { ok: true, userId: row.user_id };
}

/** Set the new password in Supabase Auth and burn the token. */
export async function completePasswordReset(token: string, password: string): Promise<ResetCheck> {
  const check = await checkResetToken(token);
  if (!check.ok) return check;
  if (!isSupabaseAdminConfigured) return { ok: false, error: "Password reset is not available right now." };

  // Claim first, so two tabs racing on the same link cannot both succeed.
  const claimed = await queryOne<{ id: string }>(
    `UPDATE password_resets SET used_at = now()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING id`,
    [hash(token)],
  );
  if (!claimed) return { ok: false, error: "This reset link has already been used. Request a new one." };

  const { error } = await supabaseAdmin().auth.admin.updateUserById(check.userId, { password });
  if (error) {
    console.error("[password-reset] supabase update failed:", error.message);
    // Give the link back so the player can try again.
    await query(`UPDATE password_resets SET used_at = NULL WHERE id = $1`, [claimed.id]);
    return { ok: false, error: "Could not update your password. Please try again." };
  }
  await query(`UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [check.userId]);
  return check;
}

/**
 * Branded, table-based email (the only layout every client renders). Colours
 * are the site's: navy #05223c, volt green #1fdc6c, lime accent #dee672.
 */
function resetEmailHtml(first: string, email: string, link: string, origin: string): string {
  const logo = `${SITE.url}/logo/sparvic-logo-white.png`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>Reset your Sparvic password</title></head>
<body style="margin:0;padding:0;background:#eef2f5;font-family:'Helvetica Neue',Arial,sans-serif;color:#06263d;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Choose a new password for your Sparvic account. The link expires in ${TTL_MINUTES} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f5;padding:28px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px -20px rgba(6,38,61,.35)">
    <tr><td style="background:#05223c;background-image:linear-gradient(160deg,#0c3a5c 0%,#05223c 60%,#031627 100%);padding:36px 28px 30px;text-align:center">
      <img src="${logo}" alt="Sparvic" width="150" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0">
      <p style="margin:18px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#a2c36d">Kolkata&rsquo;s pickleball house</p>
    </td></tr>
    <tr><td style="height:4px;background:#1fdc6c;line-height:4px;font-size:0">&nbsp;</td></tr>
    <tr><td style="padding:36px 32px 8px">
      <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:800;color:#06263d">Reset your password</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3d5566">Hi ${first},</p>
      <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#3d5566">We received a request to reset the password for your Sparvic account <strong style="color:#06263d">${email}</strong>. Tap the button below to choose a new one.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 26px"><tr><td style="border-radius:999px;background:#1fdc6c">
        <a href="${link}" style="display:inline-block;padding:15px 34px;font-size:15px;font-weight:700;color:#06263d;text-decoration:none;border-radius:999px">Choose a new password</a>
      </td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8f6;border:1px solid #dfeae4;border-radius:14px">
        <tr><td style="padding:14px 18px;font-size:13px;line-height:1.6;color:#3d5566">
          &#128274;&nbsp; This link works <strong>once</strong> and expires in <strong>${TTL_MINUTES} minutes</strong>.<br>
          Didn&rsquo;t ask for this? Ignore this email &mdash; your password won&rsquo;t change.
        </td></tr>
      </table>
      <p style="margin:24px 0 6px;font-size:12px;color:#7a8b97">Button not working? Copy this link into your browser:</p>
      <p style="margin:0 0 30px;font-size:12px;line-height:1.5;word-break:break-all"><a href="${link}" style="color:#0f8a46;text-decoration:underline">${link}</a></p>
      <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#3d5566">See you on court,<br><strong style="color:#06263d">Team Sparvic</strong></p>
    </td></tr>
    <tr><td style="background:#05223c;padding:22px 28px;text-align:center">
      <p style="margin:0 0 10px;font-size:13px">
        <a href="${origin}" style="color:#ffffff;text-decoration:none;font-weight:600">${new URL(origin).hostname.replace(/^www\./, "")}</a>
        <span style="color:#3f6a86">&nbsp;&middot;&nbsp;</span>
        <a href="${SITE.instagram}" style="color:#ffffff;text-decoration:none;font-weight:600">Instagram</a>
        <span style="color:#3f6a86">&nbsp;&middot;&nbsp;</span>
        <a href="https://wa.me/${WHATSAPP_NUMBER}" style="color:#ffffff;text-decoration:none;font-weight:600">WhatsApp</a>
      </p>
      <p style="margin:0;font-size:11px;line-height:1.6;color:#8fa6b6">You&rsquo;re receiving this because a password reset was requested for your Sparvic account.<br>&copy; ${new Date().getFullYear()} Sparvic Sports &middot; Kolkata &middot; <a href="mailto:${SITE.email}" style="color:#8fa6b6">${SITE.email}</a></p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

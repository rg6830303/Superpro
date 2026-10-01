import { createHash, randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { getUserRowByEmail } from "@/lib/accounts";
import { sendEmail, escapeHtml, isEmailConfigured } from "@/lib/email";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase";
import { SITE } from "@/lib/site";

/** How long a reset link stays valid. */
const TTL_MINUTES = 60;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Start a reset. Always resolves quietly — whether or not the email belongs to
 * an account — so the form cannot be used to find out who is registered.
 */
export async function requestPasswordReset(email: string, origin: string): Promise<void> {
  await ensureSchema();
  const user = await getUserRowByEmail(email);
  if (!user) return;

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
    text: `Hi ${first},\n\nSomeone (hopefully you) asked to reset the password for your Sparvic account.\n\nSet a new password here (valid for ${TTL_MINUTES} minutes):\n${link}\n\nIf you didn't ask for this, ignore this email — your password stays the same.\n\n— Sparvic`,
    html: resetEmailHtml(escapeHtml(first), link),
  });

  if (!sent.ok && !isEmailConfigured && !process.env.VERCEL) {
    // Local testing only (never on Vercel), before the Resend key is wired in.
    console.log(`[password-reset] email not configured — reset link for ${user.email}: ${link}`);
  }
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

function resetEmailHtml(first: string, link: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f2f5f7;font-family:Arial,Helvetica,sans-serif;color:#06263d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#05223c;padding:28px;text-align:center">
<img src="${SITE.url}/logo/sparvic-logo-white.png" alt="Sparvic" width="140" style="display:inline-block;width:140px;height:auto">
</td></tr>
<tr><td style="padding:32px 28px">
<p style="margin:0 0 12px;font-size:18px;font-weight:bold">Hi ${first},</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3d5566">Someone (hopefully you) asked to reset the password for your Sparvic account. Tap the button to choose a new one. The link works for ${TTL_MINUTES} minutes.</p>
<p style="margin:0 0 28px;text-align:center"><a href="${link}" style="display:inline-block;background:#1fdc6c;color:#06263d;font-weight:bold;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:999px">Reset my password</a></p>
<p style="margin:0 0 8px;font-size:12px;color:#7a8b97">Button not working? Paste this into your browser:</p>
<p style="margin:0 0 24px;font-size:12px;word-break:break-all"><a href="${link}" style="color:#0f8a46">${link}</a></p>
<p style="margin:0;font-size:13px;color:#7a8b97">If you didn't ask for this, ignore this email — your password stays the same.</p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:11px;color:#9aa8b2">© Sparvic Sports · Kolkata</p>
</td></tr></table></body></html>`;
}

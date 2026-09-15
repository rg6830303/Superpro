import { NextResponse } from "next/server";
import { adminGate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { checkCredentials, razorpayKeyId } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Are my payment keys working?" — answered against Razorpay itself rather than
 * against the presence of an environment variable. Admin-only, because the
 * answer tells you something about the account.
 *
 * Also reports the top-up ledger, since the useful follow-up question is
 * whether money has actually been arriving.
 */
export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const credentials = await checkCredentials();

    const [totals] = await query<{
      paid: number;
      pending: number;
      failed: number;
      paid_paise: number;
      last_paid_at: string | null;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'paid')::int      AS paid,
         COUNT(*) FILTER (WHERE status = 'pending')::int   AS pending,
         COUNT(*) FILTER (WHERE status = 'failed')::int    AS failed,
         COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid'), 0)::int AS paid_paise,
         MAX(credited_at)::text                            AS last_paid_at
       FROM wallet_topups`,
    ).catch(() => [{ paid: 0, pending: 0, failed: 0, paid_paise: 0, last_paid_at: null }]);

    return NextResponse.json({
      ok: credentials.ok,
      credentials,
      // Prefix only — never the whole id, and never the secret.
      key_id_prefix: razorpayKeyId ? `${razorpayKeyId.slice(0, 12)}…` : null,
      topups: totals,
    });
  } catch (err) {
    return serverError("payments-check", err);
  }
}

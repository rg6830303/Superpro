import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGate, audit, serverError } from "@/lib/admin";
import { adjustWallet, listWalletTransactions } from "@/lib/wallet";
import { getUserRow } from "@/lib/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  user_id: z.string().uuid("Pick a player"),
  /** Rupees, as typed in the console. Positive credits, negative debits. */
  amount_rupees: z.number().refine((v) => v !== 0, "Enter an amount"),
  kind: z.enum(["topup", "refund", "adjustment", "bonus"]).default("topup"),
  reason: z.string().trim().max(200).optional(),
});

/** Wallet history for one player, shown in the admin drawer. */
export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const userId = new URL(req.url).searchParams.get("user_id");
    if (!userId) return NextResponse.json({ error: "Missing user id." }, { status: 400 });
    const [profile, transactions] = await Promise.all([
      getUserRow(userId),
      listWalletTransactions(userId, 50),
    ]);
    if (!profile) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    return NextResponse.json({ profile, transactions });
  } catch (err) {
    return serverError("wallet:get", err);
  }
}

/**
 * Credit or debit a player's wallet. The amount arrives in RUPEES from the
 * console and is converted to paise here — the ledger and balance never see a
 * float. Every movement records which admin made it.
 */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details." }, { status: 400 });
    }
    const { user_id, amount_rupees, kind, reason } = parsed.data;
    const deltaPaise = Math.round(amount_rupees * 100);

    const result = await adjustWallet({
      userId: user_id,
      deltaPaise,
      kind,
      reason: reason || (deltaPaise > 0 ? "Credited by admin" : "Debited by admin"),
      createdBy: gate.email,
    });

    if (!result.ok) {
      const message =
        result.error === "insufficient"
          ? `That debit would take the wallet below zero (balance ₹${(result.balancePaise / 100).toFixed(0)}).`
          : result.error === "not_found"
            ? "That player no longer exists."
            : "Could not update the wallet.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    await audit(gate, "wallet.adjust", "users", user_id, { deltaPaise, kind, reason });
    return NextResponse.json({ ok: true, balance_paise: result.balancePaise });
  } catch (err) {
    return serverError("wallet:adjust", err);
  }
}

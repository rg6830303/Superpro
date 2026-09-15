import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { normaliseCode } from "@/lib/discounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = [
  "description",
  "kind",
  "percent_off",
  "amount_off_paise",
  "max_discount_paise",
  "min_spend_paise",
  "max_uses",
  "per_user_limit",
  "scopes",
  "starts_at",
  "expires_at",
  "active",
] as const;

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const codes = await query(
      `SELECT c.*,
              c.starts_at::text  AS starts_at,
              c.expires_at::text AS expires_at,
              COALESCE((SELECT SUM(r.discount_paise) FROM discount_redemptions r WHERE r.code_id = c.id), 0)::int
                AS given_away_paise,
              (SELECT MAX(r.created_at)::text FROM discount_redemptions r WHERE r.code_id = c.id)
                AS last_used_at
       FROM discount_codes c
       ORDER BY c.active DESC, c.created_at DESC`,
    );
    return NextResponse.json({ codes });
  } catch (err) {
    return serverError("discounts:list", err);
  }
}

/** Reject a code that cannot possibly discount anything, rather than minting it. */
function validateValue(body: Record<string, unknown>): string | null {
  const kind = String(body.kind ?? "percent");
  if (kind === "percent") {
    const pct = Number(body.percent_off);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return "Enter a percentage between 1 and 100.";
  } else {
    const amt = Number(body.amount_off_paise);
    if (!Number.isFinite(amt) || amt <= 0) return "Enter an amount greater than zero.";
  }
  if (body.max_uses != null && body.max_uses !== "" && Number(body.max_uses) <= 0) {
    return "Total uses must be at least 1.";
  }
  if (body.per_user_limit != null && body.per_user_limit !== "" && Number(body.per_user_limit) <= 0) {
    return "Per-person uses must be at least 1.";
  }
  if (body.starts_at && body.expires_at && String(body.expires_at) <= String(body.starts_at)) {
    return "The end date has to be after the start date.";
  }
  return null;
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const code = normaliseCode(String(body.code ?? ""));
    if (!code) return badRequest("Enter a code.");
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return badRequest("Codes are 3-32 characters: letters, numbers, dashes or underscores.");
    }
    const invalid = validateValue(body);
    if (invalid) return badRequest(invalid);

    const existing = await query(`SELECT id FROM discount_codes WHERE upper(code) = $1`, [code]);
    if (existing.length > 0) return badRequest(`${code} already exists.`);

    const kind = String(body.kind ?? "percent");
    const num = (v: unknown) => (v != null && v !== "" ? Math.round(Number(v)) : null);

    const rows = await query<{ id: string }>(
      `INSERT INTO discount_codes (code, description, kind, percent_off, amount_off_paise, max_discount_paise,
         min_spend_paise, max_uses, per_user_limit, scopes, starts_at, expires_at, active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        code,
        body.description ?? null,
        kind,
        kind === "percent" ? Number(body.percent_off) : null,
        kind === "amount" ? num(body.amount_off_paise) : null,
        num(body.max_discount_paise),
        num(body.min_spend_paise) ?? 0,
        num(body.max_uses),
        num(body.per_user_limit),
        Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : ["shop", "games", "coaching", "tournaments"],
        body.starts_at || null,
        body.expires_at || null,
        body.active === false ? false : true,
        gate.email,
      ],
    );

    await audit(gate, "discount.create", "discount_codes", rows[0].id, { code, kind });
    return NextResponse.json({ ok: true, id: rows[0].id, code });
  } catch (err) {
    return serverError("discounts:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing code id.");
    // The code itself is immutable: it may already be printed on a poster, and
    // renaming it would silently orphan every redemption recorded against it.
    delete body.code;
    delete body.used_count;

    if (body.kind || body.percent_off != null || body.amount_off_paise != null) {
      const invalid = validateValue({ ...body, kind: body.kind ?? "percent" });
      if (invalid) return badRequest(invalid);
    }

    const update = buildUpdate("discount_codes", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    await query(update.text, update.params);
    await audit(gate, "discount.update", "discount_codes", String(body.id), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("discounts:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return badRequest("Missing code id.");

    // A code that has been used is deactivated rather than deleted, so the
    // redemptions behind it keep meaning something in reporting.
    const [used] = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM discount_redemptions WHERE code_id = $1`,
      [id],
    );
    if ((used?.n ?? 0) > 0 && url.searchParams.get("purge") !== "1") {
      await query(`UPDATE discount_codes SET active = false, updated_at = now() WHERE id = $1`, [id]);
      await audit(gate, "discount.deactivate", "discount_codes", id);
      return NextResponse.json({ ok: true, deactivated: true });
    }

    await query(`DELETE FROM discount_codes WHERE id = $1`, [id]);
    await audit(gate, "discount.delete", "discount_codes", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("discounts:delete", err);
  }
}

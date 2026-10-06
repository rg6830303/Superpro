import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { ensureProgramCoach } from "@/lib/coaching-registrations";
import { DAYS, GENDERS, SKILLS, TIMINGS, VENUES, currentBatch, feeFor } from "@/lib/coaching-program";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number");
const venueIds = VENUES.map((v) => v.id) as [string, ...string[]];

const fields = {
  coach_id: z.string().uuid().nullable(),
  group_id: z.string().uuid().nullable(),
  batch: z.string().trim().min(3).max(40),
  name: z.string().trim().min(2, "Enter a name").max(80),
  gender: z.enum(GENDERS, { message: "Gender must be Male or Female" }),
  phone: mobile,
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email()]).nullable(),
  age: z.coerce.number().int().min(4).max(90),
  skill: z.enum(SKILLS.map((s) => s.id) as [string, ...string[]], { message: "Skill: beginner, novice or regular" }),
  days: z.array(z.enum(DAYS, { message: "Days as full names, e.g. Monday" })),
  venues: z.array(z.enum(venueIds, { message: `Venues: ${venueIds.join(", ")}` })),
  timings: z.array(z.enum(TIMINGS, { message: `Timings must match the form, e.g. ${TIMINGS[3]}` })),
  emergency_phone: mobile,
  emergency_relation: z.string().trim().min(2).max(40),
  medical: z.string().trim().max(300).nullable(),
  pay_venue: z.enum(venueIds),
  amount_paise: z.coerce.number().int().min(0).max(10_000_000),
  payment_status: z.enum(["unpaid", "pending", "paid", "refunded"]),
  status: z.enum(["registered", "grouped", "confirmed", "cancelled"]),
  coach_note: z.string().trim().max(300).nullable(),
};
const partial = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])) as {
  [K in keyof typeof fields]: z.ZodOptional<(typeof fields)[K]>;
};
const createSchema = z.object({
  ...partial,
  name: fields.name,
  gender: fields.gender,
  phone: fields.phone,
  age: fields.age,
  skill: fields.skill,
  pay_venue: fields.pay_venue,
  emergency_phone: fields.emergency_phone,
  emergency_relation: fields.emergency_relation,
});
const patchSchema = z.object({ id: z.string().uuid(), ...partial });

const COLUMNS = Object.keys(fields) as (keyof typeof fields)[];
const JSONB = new Set(["days", "venues", "timings"]);

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const registrations = await query(
      `SELECT r.*, r.created_at::text AS created_at, r.paid_at::text AS paid_at,
              c.name AS coach_name, g.name AS group_name
       FROM coaching_registrations r
       LEFT JOIN coaches c ON c.id = r.coach_id
       LEFT JOIN coaching_groups g ON g.id = r.group_id
       ORDER BY r.created_at DESC LIMIT 1000`,
    );
    return NextResponse.json({ registrations });
  } catch (err) {
    return serverError("coaching-registrations:list", err);
  }
}

/** Add a registration by hand (a walk-in, a phone call, an old Google Form entry). */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Check the registration.");
  try {
    const d = parsed.data;
    const coachId = d.coach_id ?? (await ensureProgramCoach());
    const fee = feeFor(d.pay_venue, d.age);
    const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const reference = "SP-" + Array.from(randomBytes(8), (b) => a[b % a.length]).join("");
    const row = await queryOne<{ id: string }>(
      `INSERT INTO coaching_registrations
         (reference, coach_id, group_id, batch, name, gender, phone, email, age, skill, days, venues, timings,
          emergency_phone, emergency_relation, medical, pay_venue, amount_paise, payment_status, status, coach_note, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,$21,
               CASE WHEN $19 = 'paid' THEN now() END)
       RETURNING id`,
      [
        reference, coachId, d.group_id ?? null, d.batch || currentBatch(), d.name, d.gender, d.phone, d.email || null,
        d.age, d.skill, JSON.stringify(d.days ?? []), JSON.stringify(d.venues?.length ? d.venues : [d.pay_venue]),
        JSON.stringify(d.timings ?? []), d.emergency_phone, d.emergency_relation, d.medical || null, d.pay_venue,
        d.amount_paise ?? (fee ?? 0) * 100, d.payment_status ?? "unpaid", d.status ?? "registered", d.coach_note || null,
      ],
    );
    await audit(gate, "coaching_registration.create", "coaching_registrations", row!.id, { name: d.name, reference });
    return NextResponse.json({ ok: true, id: row!.id, reference });
  } catch (err) {
    return serverError("coaching-registrations:create", err);
  }
}

/** Edit anything on a registration — including marking it paid for cash / UPI paid at the venue. */
export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Check the registration.");
  try {
    const { id, ...patch } = parsed.data as { id: string } & Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const col of COLUMNS) {
      if (!(col in patch) || patch[col] === undefined) continue;
      let v = patch[col];
      if (col === "email" && v === "") v = null;
      params.push(JSONB.has(col) ? JSON.stringify(v) : v);
      sets.push(`${col} = $${params.length}${JSONB.has(col) ? "::jsonb" : ""}`);
    }
    if (sets.length === 0) return badRequest("Nothing to update.");
    if (patch.payment_status === "paid") sets.push("paid_at = COALESCE(paid_at, now())");
    const row = await queryOne<{ id: string }>(
      `UPDATE coaching_registrations SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING id`,
      params,
    );
    if (!row) return badRequest("That registration no longer exists.");
    await audit(gate, "coaching_registration.update", "coaching_registrations", id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("coaching-registrations:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return badRequest("Missing registration.");
  try {
    const row = await queryOne<{ reference: string; payment_status: string }>(
      `DELETE FROM coaching_registrations WHERE id = $1 RETURNING reference, payment_status`,
      [id],
    );
    if (!row) return badRequest("That registration no longer exists.");
    await audit(gate, "coaching_registration.delete", "coaching_registrations", id, row);
    return NextResponse.json({
      ok: true,
      message: row.payment_status === "paid" ? `Deleted ${row.reference}. It was paid — refund it in Razorpay if needed.` : undefined,
    });
  } catch (err) {
    return serverError("coaching-registrations:delete", err);
  }
}

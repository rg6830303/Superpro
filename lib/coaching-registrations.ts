import { randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { COACH, currentBatch, feeFor, venueById } from "@/lib/coaching-program";

/**
 * The programme's coach on the roster, created on first use so a fresh
 * database needs no manual step. Never overwrites edits made in the admin
 * console — it only fills in a missing row.
 */
export async function ensureProgramCoach(): Promise<string> {
  await ensureSchema();
  const existing = await queryOne<{ id: string }>(`SELECT id FROM coaches WHERE slug = $1`, [COACH.slug]);
  if (existing) return existing.id;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO coaches (slug, name, headline, bio, specialties, achievements, image_url, whatsapp, experience_years, rate_paise, active, sort_order)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, 3, 500000, true, 0)
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
     RETURNING id`,
    [
      COACH.slug,
      COACH.name,
      COACH.headline,
      COACH.bio,
      JSON.stringify(COACH.specialties),
      JSON.stringify(COACH.achievements),
      COACH.image,
      "919163132551",
    ],
  );
  return row!.id;
}

/** Short, unambiguous, unguessable enough to sit in a status link. */
function newReference(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return "SP-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export type RegistrationInput = {
  name: string;
  gender: string;
  phone: string;
  email: string | null;
  age: number;
  skill: string;
  days: string[];
  venues: string[];
  timings: string[];
  emergencyPhone: string;
  emergencyRelation: string;
  medical: string | null;
  payVenue: string;
  userId: string | null;
};

export type Registration = {
  id: string;
  reference: string;
  batch: string;
  name: string;
  gender: string;
  phone: string;
  email: string | null;
  age: number;
  skill: string;
  days: string[];
  venues: string[];
  timings: string[];
  emergency_phone: string;
  emergency_relation: string;
  medical: string | null;
  pay_venue: string;
  amount_paise: number;
  payment_status: "unpaid" | "pending" | "paid" | "refunded";
  status: "registered" | "grouped" | "confirmed" | "cancelled";
  group_id: string | null;
  coach_note: string | null;
  razorpay_order_id: string | null;
  paid_at: string | null;
  created_at: string;
};

export async function createRegistration(input: RegistrationInput): Promise<Registration> {
  const coachId = await ensureProgramCoach();
  const fee = feeFor(input.payVenue, input.age);
  if (fee == null) throw new Error("fee_unavailable");
  const reference = newReference();
  const row = await queryOne<Registration>(
    `INSERT INTO coaching_registrations
       (reference, coach_id, user_id, batch, name, gender, phone, email, age, skill, days, venues, timings,
        emergency_phone, emergency_relation, medical, pay_venue, amount_paise)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      reference,
      coachId,
      input.userId,
      currentBatch(),
      input.name,
      input.gender,
      input.phone,
      input.email,
      input.age,
      input.skill,
      JSON.stringify(input.days),
      JSON.stringify(input.venues),
      JSON.stringify(input.timings),
      input.emergencyPhone,
      input.emergencyRelation,
      input.medical,
      input.payVenue,
      fee * 100,
    ],
  );
  return row!;
}

export async function getRegistration(reference: string): Promise<Registration | null> {
  return queryOne<Registration>(`SELECT * FROM coaching_registrations WHERE reference = $1`, [reference]);
}

/** Change the venue to pay for (it must be one the player picked, and offered for their age). */
export async function setPayVenue(reg: Registration, venueId: string): Promise<Registration> {
  if (!reg.venues.includes(venueId) || !venueById(venueId)) throw new Error("venue_not_chosen");
  const fee = feeFor(venueId, reg.age);
  if (fee == null) throw new Error("fee_unavailable");
  const row = await queryOne<Registration>(
    `UPDATE coaching_registrations SET pay_venue = $1, amount_paise = $2, updated_at = now() WHERE id = $3 RETURNING *`,
    [venueId, fee * 100, reg.id],
  );
  return row!;
}

export async function attachOrder(regId: string, orderId: string): Promise<void> {
  await query(
    `UPDATE coaching_registrations SET razorpay_order_id = $1, payment_status = 'pending', updated_at = now()
     WHERE id = $2 AND payment_status <> 'paid'`,
    [orderId, regId],
  );
}

/** Mark paid after the signature AND the order id have been checked by the caller. */
export async function markPaid(reference: string, orderId: string, paymentId: string): Promise<Registration | null> {
  return queryOne<Registration>(
    `UPDATE coaching_registrations
     SET payment_status = 'paid', razorpay_payment_id = $3, paid_at = COALESCE(paid_at, now()), updated_at = now()
     WHERE reference = $1 AND razorpay_order_id = $2
     RETURNING *`,
    [reference, orderId, paymentId],
  );
}

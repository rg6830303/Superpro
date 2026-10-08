import { randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

/** The club's doctor and the clinic consultation. One place for name, number and fee. */
export const DOCTOR = {
  handle: "Doctor Pickle",
  name: "Avishek Kar",
  phoneDisplay: "+91 91631 12544",
  phoneDigits: "919163112544",
  /** Clinic visit, per consultation, in rupees. */
  fee: 500,
} as const;

export const CONCERNS = [
  "Sprain or strain",
  "Knee pain",
  "Shoulder or elbow pain",
  "Back or neck pain",
  "Wrist or hand pain",
  "Muscle tightness / mobility",
  "Recovery after an injury",
  "Pre-play fitness check",
  "Other",
] as const;

/** Preferred windows; the doctor confirms the exact time. */
export const SLOTS = ["Morning (9 AM – 12 PM)", "Afternoon (12 PM – 4 PM)", "Evening (4 PM – 8 PM)"] as const;

export type Appointment = {
  id: string;
  reference: string;
  user_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  age: number;
  gender: string;
  concern: string;
  details: string | null;
  preferred_date: string;
  preferred_slot: string;
  confirmed_at: string | null;
  amount_paise: number;
  payment_status: "unpaid" | "pending" | "paid" | "refunded";
  razorpay_order_id: string | null;
  paid_at: string | null;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  admin_note: string | null;
  created_at: string;
};

const SELECT = `SELECT id, reference, user_id, name, phone, email, age, gender, concern, details,
  preferred_date::text, preferred_slot, confirmed_at::text, amount_paise, payment_status, razorpay_order_id,
  paid_at::text, status, admin_note, created_at::text FROM doctor_appointments`;

function newReference(): string {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return "DR-" + Array.from(randomBytes(8), (b) => a[b % a.length]).join("");
}

export async function createAppointment(input: {
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  age: number;
  gender: string;
  concern: string;
  details: string | null;
  preferredDate: string;
  preferredSlot: string;
}): Promise<Appointment> {
  await ensureSchema();
  const row = await queryOne<{ id: string }>(
    `INSERT INTO doctor_appointments (reference, user_id, name, phone, email, age, gender, concern, details, preferred_date, preferred_slot, amount_paise)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12) RETURNING id`,
    [newReference(), input.userId, input.name, input.phone, input.email, input.age, input.gender, input.concern,
     input.details, input.preferredDate, input.preferredSlot, DOCTOR.fee * 100],
  );
  return (await queryOne<Appointment>(`${SELECT} WHERE id = $1`, [row!.id]))!;
}

export async function getAppointment(reference: string): Promise<Appointment | null> {
  await ensureSchema();
  return queryOne<Appointment>(`${SELECT} WHERE reference = $1`, [reference]);
}

export async function listAppointments(): Promise<Appointment[]> {
  await ensureSchema();
  return query<Appointment>(`${SELECT} ORDER BY created_at DESC LIMIT 1000`);
}

export async function attachAppointmentOrder(id: string, orderId: string): Promise<void> {
  await query(
    `UPDATE doctor_appointments SET razorpay_order_id = $1, payment_status = 'pending', updated_at = now()
     WHERE id = $2 AND payment_status <> 'paid'`,
    [orderId, id],
  );
}

/** Only matches when the order id is the one created for this appointment. */
export async function markAppointmentPaid(reference: string, orderId: string, paymentId: string): Promise<Appointment | null> {
  const row = await queryOne<{ id: string }>(
    `UPDATE doctor_appointments SET payment_status = 'paid', razorpay_payment_id = $3, paid_at = COALESCE(paid_at, now()), updated_at = now()
     WHERE reference = $1 AND razorpay_order_id = $2 RETURNING id`,
    [reference, orderId, paymentId],
  );
  return row ? queryOne<Appointment>(`${SELECT} WHERE id = $1`, [row.id]) : null;
}

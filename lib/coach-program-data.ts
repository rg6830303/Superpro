import { query, queryOne } from "@/lib/db";
import type { Registration } from "@/lib/coaching-registrations";
import { DAYS } from "@/lib/coaching-program";

export type CoachGroup = {
  id: string;
  name: string;
  venue: string;
  days: string[];
  start_time: string;
  end_time: string;
  starts_on: string;
  sessions: number;
  members: number;
  paid: number;
};

/** Registrations for this coach, newest first. Coaches see contact + medical: they run the class. */
export async function listRegistrations(coachId: string): Promise<Registration[]> {
  return query<Registration>(
    `SELECT id, reference, batch, name, gender, phone, email, age, skill, days, venues, timings,
            emergency_phone, emergency_relation, medical, pay_venue, amount_paise, payment_status, status,
            group_id, coach_note, razorpay_order_id, paid_at::text, created_at::text
     FROM coaching_registrations WHERE coach_id = $1 ORDER BY created_at DESC LIMIT 500`,
    [coachId],
  );
}

export async function listGroups(coachId: string): Promise<CoachGroup[]> {
  return query<CoachGroup>(
    `SELECT g.id, g.name, g.venue, g.days, g.start_time, g.end_time, g.starts_on::text, g.sessions,
            COUNT(r.id) FILTER (WHERE r.status <> 'cancelled')::int AS members,
            COUNT(r.id) FILTER (WHERE r.status <> 'cancelled' AND r.payment_status = 'paid')::int AS paid
     FROM coaching_groups g LEFT JOIN coaching_registrations r ON r.group_id = g.id
     WHERE g.coach_id = $1 GROUP BY g.id ORDER BY g.starts_on DESC, g.start_time`,
    [coachId],
  );
}

/** The class dates of a group: its weekdays from the start date, until `sessions` classes. */
export function classDates(group: Pick<CoachGroup, "days" | "starts_on" | "sessions">): string[] {
  const wanted = new Set(group.days.map((d) => DAYS.indexOf(d as (typeof DAYS)[number])).filter((i) => i >= 0));
  if (wanted.size === 0) return [];
  const out: string[] = [];
  const [y, m, d] = group.starts_on.slice(0, 10).split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  for (let guard = 0; out.length < group.sessions && guard < 400; guard++) {
    // DAYS starts on Monday; getUTCDay() starts on Sunday.
    const mondayFirst = (day.getUTCDay() + 6) % 7;
    if (wanted.has(mondayFirst)) out.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return out;
}

export async function updateRegistration(
  coachId: string,
  id: string,
  patch: { status?: Registration["status"]; group_id?: string | null; coach_note?: string | null },
): Promise<Registration | null> {
  if (patch.group_id) {
    const owns = await queryOne<{ id: string }>(`SELECT id FROM coaching_groups WHERE id = $1 AND coach_id = $2`, [patch.group_id, coachId]);
    if (!owns) return null;
  }
  return queryOne<Registration>(
    `UPDATE coaching_registrations SET
       status = COALESCE($3, status),
       group_id = CASE WHEN $4::boolean THEN $5::uuid ELSE group_id END,
       coach_note = CASE WHEN $6::boolean THEN $7 ELSE coach_note END,
       updated_at = now()
     WHERE id = $1 AND coach_id = $2
     RETURNING id, reference, status, group_id, coach_note`,
    [
      id,
      coachId,
      patch.status ?? null,
      patch.group_id !== undefined,
      patch.group_id ?? null,
      patch.coach_note !== undefined,
      patch.coach_note ?? null,
    ],
  );
}

export async function createGroup(
  coachId: string,
  g: { name: string; venue: string; days: string[]; start_time: string; end_time: string; starts_on: string; sessions: number },
): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO coaching_groups (coach_id, name, venue, days, start_time, end_time, starts_on, sessions)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::date, $8) RETURNING id`,
    [coachId, g.name, g.venue, JSON.stringify(g.days), g.start_time, g.end_time, g.starts_on, g.sessions],
  );
  return row!;
}

/** Deleting a group sends its players back to "registered". */
export async function deleteGroup(coachId: string, id: string): Promise<boolean> {
  await query(
    `UPDATE coaching_registrations SET group_id = NULL, status = CASE WHEN status = 'grouped' THEN 'registered' ELSE status END
     WHERE group_id = $1 AND coach_id = $2`,
    [id, coachId],
  );
  const gone = await queryOne<{ id: string }>(`DELETE FROM coaching_groups WHERE id = $1 AND coach_id = $2 RETURNING id`, [id, coachId]);
  return Boolean(gone);
}

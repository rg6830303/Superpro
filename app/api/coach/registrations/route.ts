import { NextResponse } from "next/server";
import { z } from "zod";
import { liveCoachSession } from "@/lib/coach-auth";
import { listRegistrations, updateRegistration } from "@/lib/coach-program-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in coach's group-coaching registrations. */
export async function GET() {
  const session = await liveCoachSession();
  if (!session) return NextResponse.json({ error: "Sign in as a coach." }, { status: 401 });
  try {
    return NextResponse.json({ registrations: await listRegistrations(session.coach_id) });
  } catch (err) {
    console.error("[coach/registrations]", err);
    return NextResponse.json({ error: "Could not load registrations." }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["registered", "grouped", "confirmed", "cancelled"]).optional(),
  group_id: z.string().uuid().nullable().optional(),
  coach_note: z.string().trim().max(300).nullable().optional(),
});

/** Move a player through registered → grouped → confirmed, assign a group, or leave a note. */
export async function PATCH(req: Request) {
  const session = await liveCoachSession();
  if (!session) return NextResponse.json({ error: "Sign in as a coach." }, { status: 401 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const { id, ...patch } = parsed.data;
  // Putting someone in a group marks them grouped, unless a status is given too.
  if (patch.group_id && !patch.status) patch.status = "grouped";
  try {
    const row = await updateRegistration(session.coach_id, id, patch);
    if (!row) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    return NextResponse.json({ ok: true, registration: row });
  } catch (err) {
    console.error("[coach/registrations:patch]", err);
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }
}

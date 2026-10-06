import { NextResponse } from "next/server";
import { z } from "zod";
import { liveCoachSession } from "@/lib/coach-auth";
import { createGroup, deleteGroup, listGroups } from "@/lib/coach-program-data";
import { DAYS, VENUES } from "@/lib/coaching-program";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await liveCoachSession();
  if (!session) return NextResponse.json({ error: "Sign in as a coach." }, { status: 401 });
  return NextResponse.json({ groups: await listGroups(session.coach_id) });
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const schema = z
  .object({
    name: z.string().trim().min(2, "Name the group").max(60),
    venue: z.enum(VENUES.map((v) => v.id) as [string, ...string[]]),
    days: z.array(z.enum(DAYS)).min(1, "Pick at least one day"),
    start_time: z.string().regex(TIME, "Pick a start time"),
    end_time: z.string().regex(TIME, "Pick an end time"),
    starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
    sessions: z.coerce.number().int().min(1).max(40).default(8),
  })
  .refine((g) => g.end_time > g.start_time, { message: "End time must be after the start time", path: ["end_time"] });

export async function POST(req: Request) {
  const session = await liveCoachSession();
  if (!session) return NextResponse.json({ error: "Sign in as a coach." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the group details." }, { status: 400 });
  try {
    const g = await createGroup(session.coach_id, parsed.data);
    return NextResponse.json({ ok: true, id: g.id });
  } catch (err) {
    console.error("[coach/groups:post]", err);
    return NextResponse.json({ error: "Could not create the group." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await liveCoachSession();
  if (!session) return NextResponse.json({ error: "Sign in as a coach." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Missing group." }, { status: 400 });
  const ok = await deleteGroup(session.coach_id, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Group not found." }, { status: 404 });
}

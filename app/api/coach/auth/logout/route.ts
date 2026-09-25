import { NextResponse } from "next/server";
import { endCoachSession } from "@/lib/coach-auth";
import { getCoachSession } from "@/lib/auth";
import { recordAccountEvent } from "@/lib/activity";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getCoachSession();
  if (session) {
    await recordAccountEvent({ req, actorType: "coach", actorId: session.coach_id, email: session.email, name: session.name, kind: "logout" });
  }
  await endCoachSession();
  return NextResponse.json({ ok: true });
}

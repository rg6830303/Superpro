import { NextResponse } from "next/server";
import { liveCoachSession } from "@/lib/coach-auth";
import { clientForCoach } from "@/lib/coach-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await liveCoachSession();
  if (!session) return NextResponse.json({ error: "Sign in as a coach." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "No such player among your clients." }, { status: 404 });

  const client = await clientForCoach(session.coach_id, id).catch(() => null);
  // The same answer for "does not exist" and "not your client", so a coach
  // cannot probe the member list through this endpoint.
  if (!client) return NextResponse.json({ error: "No such player among your clients." }, { status: 404 });
  return NextResponse.json({ client });
}

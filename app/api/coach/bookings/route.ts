import { NextResponse } from "next/server";
import { getCoachSession } from "@/lib/auth";
import { coachBookings } from "@/lib/coach-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The signed-in coach's bookings for a date range — at most one calendar page. */
export async function GET(req: Request) {
  const session = await getCoachSession();
  if (!session) return NextResponse.json({ error: "Sign in as a coach." }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to)) return NextResponse.json({ error: "Pick a date range." }, { status: 400 });
  const span = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (!(span >= 0 && span <= 45)) return NextResponse.json({ error: "Range too long." }, { status: 400 });

  try {
    const bookings = await coachBookings(session.coach_id, from, to);
    return NextResponse.json({ bookings });
  } catch (err) {
    console.error("[coach/bookings]", err);
    return NextResponse.json({ error: "Could not load bookings." }, { status: 500 });
  }
}

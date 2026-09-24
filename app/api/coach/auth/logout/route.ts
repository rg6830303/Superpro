import { NextResponse } from "next/server";
import { endCoachSession } from "@/lib/coach-auth";

export const runtime = "nodejs";

export async function POST() {
  await endCoachSession();
  return NextResponse.json({ ok: true });
}

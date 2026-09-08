import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PLAYER_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  (await cookies()).delete(PLAYER_COOKIE);
  return NextResponse.json({ ok: true });
}

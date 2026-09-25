import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PLAYER_COOKIE, getPlayerSession } from "@/lib/auth";
import { recordAccountEvent } from "@/lib/activity";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getPlayerSession();
  if (session) {
    await recordAccountEvent({ req, actorType: "player", actorId: session.id, email: session.email, name: session.name, kind: "logout" });
  }
  (await cookies()).delete(PLAYER_COOKIE);
  return NextResponse.json({ ok: true });
}

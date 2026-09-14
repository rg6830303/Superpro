import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { uploadImage } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getPlayerSession();
    if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const form = await req.formData();
    // Keyed on the session id, so an upload always replaces the caller's own
    // photo and can never touch anyone else's.
    const result = await uploadImage(form.get("file"), `avatars/${session.id}`);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    await ensureSchema();
    await query(`UPDATE users SET avatar_url = $1, updated_at = now() WHERE id = $2`, [result.url, session.id]);

    return NextResponse.json({ ok: true, avatar_url: result.url });
  } catch (err) {
    console.error("[avatar]", err);
    return NextResponse.json({ error: "Could not upload that photo." }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await query(`UPDATE users SET avatar_url = NULL, updated_at = now() WHERE id = $1`, [session.id]).catch(() => {});
  return NextResponse.json({ ok: true });
}

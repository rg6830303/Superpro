import { NextResponse } from "next/server";
import { adminGate, badRequest, serverError } from "@/lib/admin";
import { uploadImage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOLDERS = new Set(["coaches", "products", "tournaments", "venues", "media"]);

/** Image upload for anything the admin edits — coach portraits, product shots. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const form = await req.formData();
    const folder = String(form.get("folder") ?? "media");
    if (!FOLDERS.has(folder)) return badRequest("Unknown upload folder.");

    // Random suffix so re-uploading for the same record busts any CDN copy and
    // two admins editing at once never collide on a path.
    const name = `${folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await uploadImage(form.get("file"), name, 5 * 1024 * 1024);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, url: result.url });
  } catch (err) {
    return serverError("media:upload", err);
  }
}

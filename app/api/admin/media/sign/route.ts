import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGate, badRequest, serverError } from "@/lib/admin";
import { createSignedUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  folder: z.enum(["products", "media"]),
  content_type: z.string().max(60),
  size: z.number().int().positive(),
});

/** Start a direct browser → storage upload for a product photo or video. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Invalid upload request.");
  try {
    const r = await createSignedUpload(parsed.data.folder, parsed.data.content_type, parsed.data.size);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, upload_url: r.uploadUrl, public_url: r.publicUrl, kind: r.kind });
  } catch (err) {
    return serverError("media:sign", err);
  }
}

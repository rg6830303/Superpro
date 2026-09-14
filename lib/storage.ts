import { isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "superpro-media";
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadResult = { ok: true; url: string } | { ok: false; status: number; error: string };

/**
 * Shared image upload. Everything goes through the server so the type and size
 * are checked before a byte is stored, and callers pass a path they control —
 * no client ever chooses where a file lands.
 */
export async function uploadImage(
  file: unknown,
  pathWithoutExt: string,
  maxBytes = 3 * 1024 * 1024,
): Promise<UploadResult> {
  if (!isSupabaseAdminConfigured) {
    return { ok: false, status: 503, error: "Photo uploads are not configured." };
  }
  if (!(file instanceof File)) return { ok: false, status: 400, error: "No file received." };

  const ext = ALLOWED[file.type];
  if (!ext) return { ok: false, status: 415, error: "Use a JPEG, PNG or WebP image." };
  if (file.size > maxBytes) {
    return { ok: false, status: 413, error: `Keep the image under ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  }

  const storage = supabaseAdmin().storage.from(BUCKET);
  const { error } = await storage.upload(`${pathWithoutExt}.${ext}`, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: true,
  });
  if (error) {
    console.error("[storage] upload failed:", error.message);
    return { ok: false, status: 502, error: "Could not store that image." };
  }

  const { data } = storage.getPublicUrl(`${pathWithoutExt}.${ext}`);
  // Cache-bust, or the browser keeps showing whatever was at this path before.
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}

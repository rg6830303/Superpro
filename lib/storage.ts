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

  const client = supabaseAdmin();
  const storage = client.storage.from(BUCKET);
  const key = `${pathWithoutExt}.${ext}`;
  // A Buffer, not the raw ArrayBuffer: supabase-js on Node can send an
  // ArrayBuffer as an empty body and store a 0-byte file.
  const bytes = Buffer.from(await file.arrayBuffer());

  let { error } = await storage.upload(key, bytes, {
    contentType: file.type,
    upsert: true,
  });

  // A project with no bucket yet fails every upload silently from the user's
  // point of view — the photo simply never appears. Create it once, on demand,
  // and retry, so a fresh environment works without a manual dashboard step.
  if (error && /bucket not found/i.test(error.message)) {
    console.warn(`[storage] bucket ${BUCKET} missing — creating it`);
    const created = await client.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: Object.keys(ALLOWED),
    });
    if (created.error && !/already exists/i.test(created.error.message)) {
      console.error("[storage] could not create bucket:", created.error.message);
      return { ok: false, status: 502, error: "Image storage is not set up yet." };
    }
    ({ error } = await storage.upload(key, bytes, {
      contentType: file.type,
      upsert: true,
    }));
  }

  if (error) {
    console.error("[storage] upload failed:", error.message);
    return { ok: false, status: 502, error: `Could not store that image: ${error.message}` };
  }

  const { data } = storage.getPublicUrl(key);
  // Cache-bust, or the browser keeps showing whatever was at this path before.
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}

// ── Direct uploads (product photos and videos) ───────────────────────────────

/** Media the admin can upload for products, with per-kind size limits. */
export const MEDIA_TYPES: Record<string, { ext: string; kind: "image" | "video"; maxBytes: number }> = {
  "image/jpeg": { ext: "jpg", kind: "image", maxBytes: 10 * 1024 * 1024 },
  "image/png": { ext: "png", kind: "image", maxBytes: 10 * 1024 * 1024 },
  "image/webp": { ext: "webp", kind: "image", maxBytes: 10 * 1024 * 1024 },
  "image/gif": { ext: "gif", kind: "image", maxBytes: 10 * 1024 * 1024 },
  "video/mp4": { ext: "mp4", kind: "video", maxBytes: 50 * 1024 * 1024 },
  "video/webm": { ext: "webm", kind: "video", maxBytes: 50 * 1024 * 1024 },
  "video/quicktime": { ext: "mov", kind: "video", maxBytes: 50 * 1024 * 1024 },
};
const BUCKET_LIMIT = 50 * 1024 * 1024;

let bucketReady = false;
/**
 * The bucket was created for small photos only. The first media upload widens
 * it to accept the video types and sizes above — once, and only upward.
 */
async function ensureMediaBucket(): Promise<string | null> {
  if (bucketReady) return null;
  const client = supabaseAdmin();
  const { data, error } = await client.storage.getBucket(BUCKET);
  const wanted = Object.keys(MEDIA_TYPES);
  if (error || !data) {
    const created = await client.storage.createBucket(BUCKET, { public: true, fileSizeLimit: BUCKET_LIMIT, allowedMimeTypes: wanted });
    if (created.error && !/already exists/i.test(created.error.message)) return created.error.message;
  } else {
    const allowed = new Set([...(data.allowed_mime_types ?? []), ...wanted]);
    const limit = Number(data.file_size_limit ?? 0);
    const needs = limit < BUCKET_LIMIT || wanted.some((t) => !(data.allowed_mime_types ?? []).includes(t));
    if (needs) {
      const upd = await client.storage.updateBucket(BUCKET, { public: true, fileSizeLimit: BUCKET_LIMIT, allowedMimeTypes: [...allowed] });
      if (upd.error) return upd.error.message;
    }
  }
  bucketReady = true;
  return null;
}

export type SignedUpload =
  | { ok: true; uploadUrl: string; publicUrl: string; path: string; kind: "image" | "video" }
  | { ok: false; status: number; error: string };

/**
 * A one-off signed URL the browser PUTs the file to directly — big videos never
 * pass through our server (whose request size is capped). Type and size are
 * checked here first; the bucket enforces them again on upload.
 */
export async function createSignedUpload(folder: string, contentType: string, size: number): Promise<SignedUpload> {
  if (!isSupabaseAdminConfigured) return { ok: false, status: 503, error: "Uploads are not configured." };
  const type = MEDIA_TYPES[contentType];
  if (!type) return { ok: false, status: 415, error: "Use a JPEG, PNG, WebP or GIF image, or an MP4, WebM or MOV video." };
  if (!Number.isFinite(size) || size <= 0) return { ok: false, status: 400, error: "That file is empty." };
  if (size > type.maxBytes) {
    return { ok: false, status: 413, error: `Keep ${type.kind === "video" ? "videos" : "images"} under ${Math.round(type.maxBytes / 1024 / 1024)} MB.` };
  }
  const bucketError = await ensureMediaBucket();
  if (bucketError) return { ok: false, status: 502, error: `Storage isn't ready: ${bucketError}` };
  const path = `${folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${type.ext}`;
  const storage = supabaseAdmin().storage.from(BUCKET);
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error || !data) return { ok: false, status: 502, error: `Could not start the upload: ${error?.message ?? "unknown error"}` };
  return { ok: true, uploadUrl: data.signedUrl, publicUrl: storage.getPublicUrl(path).data.publicUrl, path, kind: type.kind };
}

/** Best-effort removal of files that were uploaded but are no longer used. */
export async function removeStoredFiles(publicUrls: string[]): Promise<void> {
  if (!isSupabaseAdminConfigured || publicUrls.length === 0) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const paths = publicUrls.map((u) => (u.includes(marker) ? u.split(marker)[1].split("?")[0] : null)).filter((p): p is string => Boolean(p));
  if (paths.length) await supabaseAdmin().storage.from(BUCKET).remove(paths).catch(() => {});
}

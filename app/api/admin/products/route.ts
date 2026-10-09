import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { removeStoredFiles } from "@/lib/storage";
import { legacyColumns, parseMedia, productMedia, slugify } from "@/lib/product-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = ["paddles", "balls", "grips", "accessories"] as const;

const fields = {
  name: z.string().trim().min(2, "Enter a product name").max(120),
  slug: z.string().trim().max(80).optional(),
  category: z.enum(CATEGORIES, { message: "Pick a category" }),
  tagline: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  specs: z.array(z.string().trim().max(200)).max(40).optional(),
  price_paise: z.coerce.number().int().min(0, "Price can't be negative").max(100_000_000),
  compare_at_paise: z.coerce.number().int().min(0).max(100_000_000).nullable().optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
  media: z.array(z.unknown()).optional(),
};
const createSchema = z.object(fields);
const patchSchema = z.object({ id: z.string().uuid(), ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])) });

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "product";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const hit = await queryOne<{ id: string }>(`SELECT id FROM products WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2)`, [candidate, excludeId ?? null]);
    if (!hit) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const rows = await query<Record<string, unknown>>(`SELECT * FROM products ORDER BY sort_order, name`);
    const products = rows.map((p) => ({ ...p, media: productMedia(p as never) }));
    return NextResponse.json({ products });
  } catch (err) {
    return serverError("products:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Check the product details.");
  try {
    await ensureSchema();
    const d = parsed.data;
    const m = parseMedia(d.media ?? []);
    if (!m.ok) return badRequest(m.error);
    const legacy = legacyColumns(m.media);
    const slug = await uniqueSlug(d.slug || d.name);
    const row = await queryOne<{ id: string }>(
      `INSERT INTO products (slug, name, category, tagline, description, specs, price_paise, compare_at_paise,
         image_url, gallery, media, stock, featured, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15) RETURNING id`,
      [slug, d.name, d.category, d.tagline || null, d.description || null, JSON.stringify(d.specs ?? []), d.price_paise,
       d.compare_at_paise || null, legacy.image_url, JSON.stringify(legacy.gallery), JSON.stringify(m.media),
       d.stock ?? 0, d.featured ?? false, d.active ?? true, d.sort_order ?? 0],
    );
    await audit(gate, "product.create", "products", row!.id, { name: d.name, media: m.media.length });
    return NextResponse.json({ ok: true, id: row!.id, slug });
  } catch (err) {
    return serverError("products:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Check the product details.");
  try {
    await ensureSchema();
    const { id, ...d } = parsed.data as { id: string } & Partial<z.infer<typeof createSchema>>;
    const current = await queryOne<Record<string, unknown>>(`SELECT * FROM products WHERE id = $1`, [id]);
    if (!current) return badRequest("That product no longer exists.");

    const sets: string[] = [];
    const params: unknown[] = [id];
    const set = (col: string, val: unknown, cast = "") => {
      params.push(val);
      sets.push(`${col} = $${params.length}${cast}`);
    };
    if (d.name !== undefined) set("name", d.name);
    if (d.slug !== undefined) set("slug", await uniqueSlug(d.slug || d.name || String(current.name), id));
    if (d.category !== undefined) set("category", d.category);
    if (d.tagline !== undefined) set("tagline", d.tagline || null);
    if (d.description !== undefined) set("description", d.description || null);
    if (d.specs !== undefined) set("specs", JSON.stringify(d.specs), "::jsonb");
    if (d.price_paise !== undefined) set("price_paise", d.price_paise);
    if (d.compare_at_paise !== undefined) set("compare_at_paise", d.compare_at_paise || null);
    if (d.stock !== undefined) set("stock", d.stock);
    if (d.featured !== undefined) set("featured", d.featured);
    if (d.active !== undefined) set("active", d.active);
    if (d.sort_order !== undefined) set("sort_order", d.sort_order);

    let removed: string[] = [];
    if (d.media !== undefined) {
      const m = parseMedia(d.media);
      if (!m.ok) return badRequest(m.error);
      const legacy = legacyColumns(m.media);
      set("media", JSON.stringify(m.media), "::jsonb");
      set("image_url", legacy.image_url);
      set("gallery", JSON.stringify(legacy.gallery), "::jsonb");
      const keep = new Set(m.media.map((x) => x.url));
      removed = productMedia(current as never).map((x) => x.url).filter((u) => !keep.has(u) && u.includes("/products/"));
    }
    if (sets.length === 0) return badRequest("Nothing to update.");
    await query(`UPDATE products SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, params);
    // Files the product no longer uses are deleted from storage.
    if (removed.length) await removeStoredFiles(removed);
    await audit(gate, "product.update", "products", id, { ...d, media: d.media ? `${(d.media as unknown[]).length} items` : undefined });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("products:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing product id.");
    // On an existing order → archived (hidden), so the order history still points at it.
    const ordered = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM orders WHERE items::text LIKE '%' || $1 || '%'`, [id]);
    if (Number(ordered[0]?.n ?? 0) === 0) {
      const gone = await queryOne<Record<string, unknown>>(`DELETE FROM products WHERE id = $1 RETURNING *`, [id]);
      if (gone) await removeStoredFiles(productMedia(gone as never).map((x) => x.url).filter((u) => u.includes("/products/")));
      await audit(gate, "product.delete", "products", id);
      return NextResponse.json({ ok: true, deleted: true });
    }
    await query(`UPDATE products SET active = false, updated_at = now() WHERE id = $1`, [id]);
    await audit(gate, "product.archive", "products", id);
    return NextResponse.json({ ok: true, archived: true, message: "This product is on existing orders, so it was hidden from the shop rather than deleted." });
  } catch (err) {
    return serverError("products:delete", err);
  }
}

import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, jsonbFields, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = [
  "name",
  "slug",
  "category",
  "tagline",
  "description",
  "specs",
  "price_paise",
  "compare_at_paise",
  "image_url",
  "gallery",
  "stock",
  "featured",
  "active",
  "sort_order",
] as const;

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const products = await query(`SELECT * FROM products ORDER BY sort_order, name`);
    return NextResponse.json({ products });
  } catch (err) {
    return serverError("products:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.name || !body.slug || !body.category) {
      return badRequest("Name, slug and category are required.");
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO products (slug, name, category, tagline, description, specs, price_paise,
         compare_at_paise, image_url, gallery, stock, featured, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'[]')::jsonb,$7,$8,$9,COALESCE($10,'[]')::jsonb,$11,$12,$13,$14)
       RETURNING id`,
      [
        body.slug,
        body.name,
        body.category,
        body.tagline ?? null,
        body.description ?? null,
        body.specs ? JSON.stringify(body.specs) : null,
        Number(body.price_paise ?? 0),
        body.compare_at_paise ? Number(body.compare_at_paise) : null,
        body.image_url ?? null,
        body.gallery ? JSON.stringify(body.gallery) : null,
        Number(body.stock ?? 0),
        Boolean(body.featured),
        body.active === false ? false : true,
        Number(body.sort_order ?? 0),
      ],
    );
    await audit(gate, "product.create", "products", rows[0].id, { name: body.name });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    return serverError("products:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = jsonbFields((await req.json().catch(() => ({}))) as Record<string, unknown>, [
      "specs",
      "gallery",
    ]);
    if (!body.id) return badRequest("Missing product id.");
    const update = buildUpdate("products", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    const rows = await query(`${update.text}`, update.params);
    await audit(gate, "product.update", "products", String(body.id), body);
    return NextResponse.json({ ok: true, product: rows[0] ?? null });
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
    // Soft delete: orders reference product names historically, and an
    // accidental hard delete is not recoverable from the console.
    await query(`UPDATE products SET active = false, updated_at = now() WHERE id = $1`, [id]);
    await audit(gate, "product.archive", "products", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("products:delete", err);
  }
}

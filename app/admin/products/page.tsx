"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Film, ImagePlus, Pencil, Star, Trash2, Upload } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { AddButton, Drawer, ListState, submitResource } from "@/components/admin/crud";
import { Alert, Spinner } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import type { ProductMedia } from "@/lib/types";

type Product = {
  id: string; slug: string; name: string; category: string; tagline: string | null; description: string | null;
  specs: string[]; price_paise: number; compare_at_paise: number | null; image_url: string | null; media: ProductMedia[];
  stock: number; featured: boolean; active: boolean; sort_order: number;
};

const CATEGORIES = [
  { value: "paddles", label: "Paddles" },
  { value: "balls", label: "Balls" },
  { value: "grips", label: "Grips" },
  { value: "accessories", label: "Accessories" },
];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load products.");
      setProducts(data.products ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const lowStock = products.filter((p) => p.active && p.stock < 6).length;
  const stockValue = products.reduce((sum, p) => sum + p.price_paise * p.stock, 0);

  return (
    <div>
      <AdminHeader title="Products" sub="Create and edit shop products — photos, videos, price and stock. Changes show on the shop straight away." action={<AddButton label="Add product" onClick={() => setEditing("new")} />} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile label="Listed" value={products.filter((p) => p.active).length} />
        <StatTile label="Low stock" value={lowStock} tone={lowStock ? "warn" : "default"} />
        <StatTile label="Stock value" value={formatPaise(stockValue)} tone="accent" />
      </div>

      <ListState loading={loading} error={error} empty={products.length === 0} emptyLabel="No products yet. Add your first one." />

      {!loading && products.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const cover = p.media[0];
            const photos = p.media.filter((m) => m.type === "image").length;
            const videos = p.media.length - photos;
            return (
              <li key={p.id} className={`card flex gap-4 p-4 ${p.active ? "" : "opacity-60"}`}>
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-mist">
                  {cover?.type === "video" ? (
                    <video src={cover.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.url} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <span className="grid h-full place-items-center text-[10px] text-ink/40">No photo</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{p.name}</p>
                  <p className="text-xs capitalize text-ink/55">{p.category} · {photos} photo{photos === 1 ? "" : "s"}{videos ? ` · ${videos} video${videos === 1 ? "" : "s"}` : ""}</p>
                  <p className="mt-1 font-display text-lg text-ink">{formatPaise(p.price_paise)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={p.active ? "chip-volt" : "chip"}>{p.active ? "Listed" : "Hidden"}</span>
                    <span className={p.stock < 6 ? "chip-warn" : "chip"}>{p.stock} in stock</span>
                    {p.featured && <span className="chip">Featured</span>}
                  </div>
                </div>
                <button type="button" onClick={() => setEditing(p)} className="btn-outline btn-sm self-start" aria-label={`Edit ${p.name}`}><Pencil size={13} /></button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && <ProductEditor product={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

type Upload = { id: string; name: string; progress: number; error?: string };

/** Upload one file straight to storage through a signed URL, reporting progress. */
async function uploadFile(file: File, onProgress: (p: number) => void): Promise<ProductMedia> {
  const res = await fetch("/api/admin/media/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ folder: "products", content_type: file.type, size: file.size }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not start the upload.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.upload_url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed — check the connection."));
    xhr.send(file);
  });
  return { type: data.kind === "video" ? "video" : "image", url: data.public_url };
}

function ProductEditor({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [category, setCategory] = useState(product?.category ?? "paddles");
  const [price, setPrice] = useState(product ? String(product.price_paise / 100) : "");
  const [compareAt, setCompareAt] = useState(product?.compare_at_paise ? String(product.compare_at_paise / 100) : "");
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [tagline, setTagline] = useState(product?.tagline ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [specs, setSpecs] = useState((product?.specs ?? []).join("\n"));
  const [sortOrder, setSortOrder] = useState(String(product?.sort_order ?? 0));
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [active, setActive] = useState(product?.active ?? true);
  const [media, setMedia] = useState<ProductMedia[]>(product?.media ?? []);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploading = uploads.some((u) => !u.error && u.progress < 100);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = `${Date.now()}-${Math.random()}`;
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      try {
        const item = await uploadFile(file, (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))));
        setMedia((m) => [...m, item]);
        setUploads((u) => u.filter((x) => x.id !== id));
      } catch (err) {
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, error: err instanceof Error ? err.message : "Upload failed." } : x)));
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const move = (from: number, to: number) =>
    setMedia((m) => {
      if (to < 0 || to >= m.length) return m;
      const next = [...m];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });

  async function save() {
    setError(null);
    if (name.trim().length < 2) return setError("Enter a product name.");
    const p = Number(price);
    if (!price || !Number.isFinite(p) || p < 0) return setError("Enter a price in rupees.");
    if (uploading) return setError("Wait for the uploads to finish.");
    setBusy(true);
    const body = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      category,
      price_paise: Math.round(p * 100),
      compare_at_paise: compareAt ? Math.round(Number(compareAt) * 100) : null,
      stock: Math.max(0, Math.round(Number(stock) || 0)),
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      specs: specs.split("\n").map((s) => s.trim()).filter(Boolean),
      sort_order: Math.round(Number(sortOrder) || 0),
      featured,
      active,
      media,
    };
    const err = product ? await submitResource("/api/admin/products", "PATCH", { id: product.id, ...body }) : await submitResource("/api/admin/products", "POST", body);
    setBusy(false);
    if (err) return setError(err);
    onSaved();
    onClose();
  }

  async function remove() {
    if (!product || !confirm(`Delete "${product.name}"? If it's on past orders it will be hidden instead.`)) return;
    setBusy(true);
    const err = await submitResource(`/api/admin/products?id=${product.id}`, "DELETE");
    setBusy(false);
    if (err) return setError(err);
    onSaved();
    onClose();
  }

  return (
    <Drawer
      title={product ? product.name : "New product"}
      sub={product ? `/products/${product.slug}` : "Fill in the details, add photos or videos, then publish."}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-3">
          {product && <button type="button" onClick={remove} disabled={busy} className="btn-danger btn-sm"><Trash2 size={14} /> Delete</button>}
          <button type="button" onClick={save} disabled={busy || uploading} className="btn-primary ml-auto">
            {busy ? <Spinner /> : null} {product ? "Save changes" : "Publish product"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Media */}
        <section>
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-ink">Photos &amp; videos</p>
            <span className="text-xs text-ink/50">{media.length}/20</span>
          </div>
          <p className="mt-1 text-xs text-ink/55">The first item is the cover on the shop. Drag to reorder, or use the arrows. Photos up to 10 MB, videos (MP4, WebM, MOV) up to 50 MB.</p>

          {media.length > 0 && (
            <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {media.map((m, i) => (
                <li
                  key={m.url}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
                  className={`group relative overflow-hidden rounded-xl border bg-mist ${i === 0 ? "border-volt-deep ring-2 ring-volt/50" : "border-line"} ${dragIdx === i ? "opacity-50" : ""}`}
                >
                  <div className="aspect-square">
                    {m.type === "video" ? (
                      <video src={m.url} muted playsInline loop preload="metadata" className="h-full w-full object-cover" onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="h-full w-full object-contain p-1" />
                    )}
                  </div>
                  <span className="absolute left-1.5 top-1.5 rounded-pill bg-ink/80 px-2 py-0.5 font-mono text-[10px] text-paper">
                    {i === 0 ? "Cover" : i + 1}{m.type === "video" ? " · video" : ""}
                  </span>
                  <div className="flex items-center justify-between gap-1 border-t border-line bg-paper px-1.5 py-1">
                    <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded p-1.5 text-ink/60 hover:bg-mist disabled:opacity-30"><ArrowLeft size={14} /></button>
                    {i !== 0 && <button type="button" aria-label="Make cover" title="Make cover" onClick={() => move(i, 0)} className="rounded p-1.5 text-ink/60 hover:bg-mist"><Star size={14} /></button>}
                    <button type="button" aria-label="Move later" disabled={i === media.length - 1} onClick={() => move(i, i + 1)} className="rounded p-1.5 text-ink/60 hover:bg-mist disabled:opacity-30"><ArrowRight size={14} /></button>
                    <button type="button" aria-label="Remove" onClick={() => setMedia((x) => x.filter((_, j) => j !== i))} className="rounded p-1.5 text-ink/50 hover:bg-signal/10 hover:text-signal"><Trash2 size={14} /></button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {uploads.length > 0 && (
            <ul className="mt-3 space-y-2">
              {uploads.map((u) => (
                <li key={u.id} className="rounded-lg border border-line p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-ink/75">{u.name}</span>
                    {u.error ? (
                      <button type="button" className="text-ink/50 hover:text-ink" onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))}>Dismiss</button>
                    ) : (
                      <span className="tabular-nums text-ink/55">{u.progress}%</span>
                    )}
                  </div>
                  {u.error ? <p className="mt-1 text-signal">{u.error}</p> : <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist"><div className="h-full bg-volt transition-all" style={{ width: `${u.progress}%` }} /></div>}
                </li>
              ))}
            </ul>
          )}

          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => void addFiles(e.target.files)} id="pm-files" />
          <label
            htmlFor="pm-files"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (dragIdx === null) void addFiles(e.dataTransfer.files); }}
            className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center text-sm text-ink/60 hover:border-volt-deep hover:text-ink"
          >
            <span className="flex gap-2"><ImagePlus size={18} /><Film size={18} /></span>
            <span className="font-semibold"><Upload size={13} className="mr-1 inline" />Upload photos or videos</span>
            <span className="text-xs text-ink/45">Tap to choose, or drop files here. You can pick several at once.</span>
          </label>
        </section>

        {/* Details */}
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="label">Product name *</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label><span className="label">Category</span>
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          </label>
          <label><span className="label">Stock</span><input className="field" type="number" min={0} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} /></label>
          <label><span className="label">Price (₹) *</span><input className="field" type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 9000" /></label>
          <label><span className="label">Compare-at price (₹)</span><input className="field" type="number" min={0} inputMode="decimal" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="Optional — shows a saving" /></label>
          <label className="sm:col-span-2"><span className="label">Tagline</span><input className="field" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One line under the name" /></label>
          <label className="sm:col-span-2"><span className="label">Description</span><textarea className="field min-h-[110px]" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label className="sm:col-span-2"><span className="label">Specifications</span><textarea className="field min-h-[90px]" value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder={"One per line, e.g.\nWeight: 230 g\nCore: 16 mm honeycomb"} /></label>
          <label><span className="label">URL slug</span><input className="field" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Made from the name if blank" /></label>
          <label><span className="label">Sort order</span><input className="field" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Listed in the shop</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Feature on the home page</label>
        </section>

        {error && <Alert>{error}</Alert>}
      </div>
    </Drawer>
  );
}

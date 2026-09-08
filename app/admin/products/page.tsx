"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { AddButton, ListState, RecordEditor, submitResource, type FieldDef } from "@/components/admin/crud";
import { formatPaise } from "@/lib/money";

type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string | null;
  description: string | null;
  specs: string[];
  price_paise: number;
  compare_at_paise: number | null;
  image_url: string | null;
  gallery: string[];
  stock: number;
  featured: boolean;
  active: boolean;
  sort_order: number;
};

const CATEGORIES = [
  { value: "paddles", label: "Paddles" },
  { value: "balls", label: "Balls" },
  { value: "grips", label: "Grips" },
  { value: "accessories", label: "Accessories" },
];

const FIELDS: FieldDef[] = [
  { name: "name", label: "Product name", required: true },
  { name: "slug", label: "URL slug", required: true, hint: "lowercase-with-dashes" },
  { name: "category", label: "Category", type: "select", options: CATEGORIES },
  { name: "stock", label: "Stock", type: "number" },
  { name: "tagline", label: "Tagline", full: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "specs", label: "Specification lines", type: "list" },
  { name: "price_paise", label: "Price (paise)", type: "number", hint: "900000 = ₹9,000", required: true },
  { name: "compare_at_paise", label: "Compare-at price (paise)", type: "number", hint: "Optional — shows a saving" },
  { name: "image_url", label: "Main image URL", full: true, placeholder: "/products/paddle-champion-t700.png" },
  { name: "gallery", label: "Gallery image URLs", type: "list" },
  { name: "sort_order", label: "Sort order", type: "number" },
  { name: "featured", label: "Feature on the home page", type: "checkbox" },
  { name: "active", label: "Listed in the shop", type: "checkbox" },
];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

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

  useEffect(() => {
    load();
  }, [load]);

  const lowStock = products.filter((p) => p.active && p.stock < 6).length;
  const stockValue = products.reduce((sum, p) => sum + p.price_paise * p.stock, 0);

  return (
    <div>
      <AdminHeader
        title="Products"
        sub="The Champion Series catalogue."
        action={<AddButton label="New product" onClick={() => setCreating(true)} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Listed products" value={products.filter((p) => p.active).length} />
        <StatTile label="Low stock" value={lowStock} tone={lowStock > 0 ? "warn" : "default"} hint="Fewer than 6 left" />
        <StatTile label="Stock value" value={formatPaise(stockValue)} tone="gold" />
      </div>

      <ListState loading={loading} error={error} empty={products.length === 0} emptyLabel="No products yet." />

      {!loading && products.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Flags</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="block font-semibold text-bone">{p.name}</span>
                    <span className="block text-xs text-bone/40">/{p.slug}</span>
                  </td>
                  <td className="capitalize">{p.category}</td>
                  <td>
                    <span className="block">{formatPaise(p.price_paise)}</span>
                    {p.compare_at_paise ? (
                      <span className="block text-xs text-bone/35 line-through">{formatPaise(p.compare_at_paise)}</span>
                    ) : null}
                  </td>
                  <td className={p.stock === 0 ? "text-danger" : p.stock < 6 ? "text-gold" : undefined}>{p.stock}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {p.featured && <span className="chip-gold py-0 text-[10px]">Featured</span>}
                      <span className={p.active ? "chip-live py-0 text-[10px]" : "chip py-0 text-[10px]"}>
                        {p.active ? "Live" : "Archived"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button type="button" onClick={() => setEditing(p)} className="btn-outline btn-sm">
                      <Pencil size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <RecordEditor
          title={editing ? editing.name : "New product"}
          fields={FIELDS}
          initial={
            editing
              ? {
                  name: editing.name,
                  slug: editing.slug,
                  category: editing.category,
                  stock: editing.stock,
                  tagline: editing.tagline ?? "",
                  description: editing.description ?? "",
                  specs: editing.specs ?? [],
                  price_paise: editing.price_paise,
                  compare_at_paise: editing.compare_at_paise,
                  image_url: editing.image_url ?? "",
                  gallery: editing.gallery ?? [],
                  sort_order: editing.sort_order,
                  featured: editing.featured,
                  active: editing.active,
                }
              : {
                  category: "paddles",
                  stock: 0,
                  price_paise: 0,
                  specs: [],
                  gallery: [],
                  sort_order: 0,
                  featured: false,
                  active: true,
                }
          }
          submitLabel={editing ? "Save product" : "Add product"}
          deleteLabel="Archive"
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const err = editing
              ? await submitResource("/api/admin/products", "PATCH", { id: editing.id, ...values })
              : await submitResource("/api/admin/products", "POST", values);
            if (!err) await load();
            return err;
          }}
          onDelete={
            editing
              ? async () => {
                  const err = await submitResource(`/api/admin/products?id=${editing.id}`, "DELETE");
                  if (!err) await load();
                  return err;
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

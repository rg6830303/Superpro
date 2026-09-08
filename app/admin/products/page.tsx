"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/shell";
import { Spinner } from "@/components/ui";
import { formatRupees } from "@/lib/money";

export default function AdminProductsPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      if (res.ok) setProducts(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <AdminHeader title="Products & Inventory" sub="Paddles, balls and accessories" />
      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Catalog Products ({products.length})</h2>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-bone/50">No products configured yet.</td></tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td className="font-bold">{p.name}</td>
                      <td className="capitalize">{p.category}</td>
                      <td>{formatRupees(p.price_paise)}</td>
                      <td>{p.stock} units</td>
                      <td><span className={p.active ? "chip-live" : "chip"}>{p.active ? "Active" : "Draft"}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

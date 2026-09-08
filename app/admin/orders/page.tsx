"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/shell";
import { Spinner } from "@/components/ui";
import { formatRupees } from "@/lib/money";

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (res.ok) setOrders(await res.json());
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
      <AdminHeader title="Orders" sub="Equipment and paddle sales fulfillment" />
      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Customer Orders ({orders.length})</h2>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Fulfillment</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-bone/50">No customer orders placed yet.</td></tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id}>
                      <td className="font-mono text-gold">{o.order_no}</td>
                      <td>{o.customer_name} ({o.customer_phone})</td>
                      <td>{formatRupees(o.total_paise)}</td>
                      <td><span className="chip">{o.payment_status}</span></td>
                      <td><span className="chip-volt">{o.fulfillment_status}</span></td>
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

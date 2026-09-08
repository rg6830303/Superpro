"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/shell";
import { Spinner } from "@/components/ui";

export default function AdminWhatsappPage() {
  const [loading, setLoading] = useState(true);
  const [outbox, setOutbox] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp");
      if (res.ok) setOutbox(await res.json());
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
      <AdminHeader title="WhatsApp Integration" sub="Group announcements and notification outbox" />
      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Outbox Messages ({outbox.length})</h2>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {outbox.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-bone/50">No WhatsApp messages in outbox.</td></tr>
                ) : (
                  outbox.map((w) => (
                    <tr key={w.id}>
                      <td className="capitalize font-semibold">{w.target}</td>
                      <td className="max-w-md truncate">{w.message}</td>
                      <td><span className="chip-volt">{w.status}</span></td>
                      <td>{new Date(w.created_at).toLocaleDateString()}</td>
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

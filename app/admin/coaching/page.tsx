"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/shell";
import { Spinner } from "@/components/ui";

export default function AdminCoachingPage() {
  const [loading, setLoading] = useState(true);
  const [coaching, setCoaching] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coaching");
      if (res.ok) setCoaching(await res.json());
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
      <AdminHeader title="Coaching Bookings" sub="Certified coach requests and client sessions" />
      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Coaching Requests ({coaching.length})</h2>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Booking #</th>
                  <th>Player</th>
                  <th>Coach</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {coaching.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-bone/50">No coaching requests placed yet.</td></tr>
                ) : (
                  coaching.map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono text-gold">{c.booking_no}</td>
                      <td>{c.player_name} ({c.player_phone})</td>
                      <td>{c.coach_name ?? "Coach"}</td>
                      <td className="capitalize">{c.session_type}</td>
                      <td><span className="chip-gold">{c.status}</span></td>
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

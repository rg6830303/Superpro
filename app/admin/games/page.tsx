"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/shell";
import { Spinner } from "@/components/ui";

export default function AdminGamesPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sessions");
      if (res.ok) setSessions(await res.json());
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
      <AdminHeader title="Daily Games" sub="Manage venues, court slots and registrations" />
      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Open Game Sessions ({sessions.length})</h2>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Venue</th>
                  <th>Court</th>
                  <th>Time</th>
                  <th>Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-bone/50">No game sessions scheduled yet.</td></tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.session_date}</td>
                      <td>{s.venue_name ?? "Venue"}</td>
                      <td>Court {s.court_number}</td>
                      <td>{s.start_time} - {s.end_time}</td>
                      <td className="capitalize">{s.level}</td>
                      <td><span className="chip-gold">{s.status}</span></td>
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

"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/shell";
import { Spinner } from "@/components/ui";

export default function AdminTournamentsPage() {
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tournaments");
      if (res.ok) setTournaments(await res.json());
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
      <AdminHeader title="Tournaments & Draws" sub="Organized and sponsored pickleball series" />
      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Tournaments ({tournaments.length})</h2>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Venue</th>
                  <th>Dates</th>
                  <th>Kind</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-bone/50">No tournaments scheduled yet.</td></tr>
                ) : (
                  tournaments.map((t) => (
                    <tr key={t.id}>
                      <td className="font-bold">{t.title}</td>
                      <td>{t.venue ?? "Kolkata"}</td>
                      <td>{t.start_date}</td>
                      <td className="capitalize">{t.kind}</td>
                      <td><span className="chip-volt">{t.status}</span></td>
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

"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/shell";
import { Spinner } from "@/components/ui";

export default function AdminPlayersPage() {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/players");
      if (res.ok) setPlayers(await res.json());
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
      <AdminHeader title="Player Directory" sub="Registered pickleball players and ratings" />
      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Players ({players.length})</h2>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Skill Level</th>
                  <th>DUPR</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-bone/50">No registered players found.</td></tr>
                ) : (
                  players.map((p) => (
                    <tr key={p.id}>
                      <td className="font-bold">{p.full_name}</td>
                      <td>{p.email}</td>
                      <td>{p.phone}</td>
                      <td className="capitalize">{p.skill_level}</td>
                      <td>{p.dupr ?? "N/A"}</td>
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

"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/shell";
import { Spinner } from "@/components/ui";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<any>(null);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) setInfo(await res.json());
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
      <AdminHeader title="Platform Settings" sub="Database, environment variables and configuration" />
      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Environment Status</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border border-line rounded-xl p-4 bg-mist">
                <p className="text-xs text-ink/65 uppercase">Database Connected</p>
                <p className="mt-1 font-semibold">{info?.db?.configured ? "Yes (Supabase Postgres)" : "Not Configured"}</p>
              </div>
              <div className="border border-line rounded-xl p-4 bg-mist">
                <p className="text-xs text-ink/65 uppercase">Admin Host</p>
                <p className="mt-1 font-semibold">{info?.adminHost ?? "superproadmin.vercel.app"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

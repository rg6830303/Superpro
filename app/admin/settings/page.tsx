"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { AdminHeader } from "@/components/admin/shell";
import { Alert, Spinner } from "@/components/ui";

type Integrations = {
  whatsapp: { hasRelay: boolean; hasCloudApi: boolean; hasGroupJid: boolean };
  razorpay: boolean;
  db: { configured: boolean; port: string | null; endpoint: string; pooled: boolean };
  adminHost: string | null;
};

/** The operator-editable settings, grouped by what they actually affect. */
const GROUPS: Array<{ title: string; note: string; fields: Array<{ key: string; label: string; hint?: string; multiline?: boolean }> }> = [
  {
    title: "Contact",
    note: "Powers every “chat with a rep” button and the games-group link.",
    fields: [
      { key: "whatsapp_number", label: "WhatsApp number", hint: "With country code, e.g. 919163132551" },
      { key: "rep_name", label: "Representative name" },
      { key: "whatsapp_group_url", label: "Games group invite link" },
    ],
  },
  {
    title: "Defaults",
    note: "Starting values for new slots and coaching blocks. Existing rows keep their own.",
    fields: [
      { key: "daily_game_price", label: "Default game price (paise)", hint: "35000 = ₹350" },
      { key: "coaching_rate", label: "Default coaching rate (paise)", hint: "120000 = ₹1,200" },
    ],
  },
  {
    title: "Copy",
    note: "Shown to players on the booking pages.",
    fields: [
      { key: "booking_terms", label: "Booking terms", multiline: true },
      { key: "home_notice", label: "Home page note", multiline: true },
    ],
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load settings.");
      setSettings(data.settings ?? {});
      setIntegrations(data.integrations ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setSettings(data.settings ?? settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const set = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <AdminHeader
        title="Settings"
        sub="Values you can change without a redeploy, and the state of everything you cannot."
        action={
          <button type="button" onClick={load} className="btn-outline btn-sm">
            <RefreshCw size={13} /> Reload
          </button>
        }
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size={22} />
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            {GROUPS.map((group) => (
              <section key={group.title} className="card p-6">
                <h2 className="text-2xl">{group.title}</h2>
                <p className="mt-1 text-xs text-ink/55">{group.note}</p>
                <div className="mt-5 space-y-4">
                  {group.fields.map((f) => (
                    <div key={f.key}>
                      <label className="label" htmlFor={`s-${f.key}`}>
                        {f.label}
                      </label>
                      {f.multiline ? (
                        <textarea
                          id={`s-${f.key}`}
                          rows={3}
                          className="field resize-none"
                          value={settings[f.key] ?? ""}
                          onChange={(e) => set(f.key, e.target.value)}
                        />
                      ) : (
                        <input
                          id={`s-${f.key}`}
                          className="field"
                          value={settings[f.key] ?? ""}
                          onChange={(e) => set(f.key, e.target.value)}
                        />
                      )}
                      {f.hint && <p className="mt-1.5 text-[11px] text-ink/45">{f.hint}</p>}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {error && <Alert>{error}</Alert>}
            {saved && <Alert tone="ok">Saved. The site picks these up on the next page load.</Alert>}

            <button type="button" onClick={save} disabled={busy} className="btn-volt">
              {busy ? <Spinner /> : <Check size={15} />} {busy ? "Saving…" : "Save settings"}
            </button>
          </div>

          {/* Read-only: these come from environment variables, not the database. */}
          <aside className="space-y-5">
            <section className="card p-6">
              <h2 className="text-2xl">Connections</h2>
              <p className="mt-1 text-xs text-ink/55">
                Set in Vercel, not here. A redeploy is needed to change any of these.
              </p>
              <dl className="mt-5 space-y-3 text-sm">
                {[
                  {
                    k: "Database",
                    v: integrations?.db.configured
                      ? integrations.db.pooled
                        ? `Connected · pooler :${integrations.db.port}`
                        : `Connected · NOT pooled (:${integrations.db.port})`
                      : "Not configured",
                    ok: Boolean(integrations?.db.pooled),
                  },
                  {
                    k: "Online payments",
                    v: integrations?.razorpay ? "Razorpay live" : "Off — pay at venue only",
                    ok: Boolean(integrations?.razorpay),
                  },
                  {
                    k: "WhatsApp group posting",
                    v: integrations?.whatsapp.hasRelay ? "Automatic via relay" : "Manual — one tap per message",
                    ok: Boolean(integrations?.whatsapp.hasRelay),
                  },
                  {
                    k: "WhatsApp direct messages",
                    v: integrations?.whatsapp.hasCloudApi ? "Cloud API connected" : "Not configured",
                    ok: Boolean(integrations?.whatsapp.hasCloudApi),
                  },
                  { k: "Admin host", v: integrations?.adminHost ?? "Not set", ok: Boolean(integrations?.adminHost) },
                ].map((row) => (
                  <div key={row.k} className="flex items-start justify-between gap-4 border-b border-line/70 pb-3 last:border-0">
                    <dt className="text-ink/65">{row.k}</dt>
                    <dd className="flex items-center gap-2 text-right">
                      <span className={`live-dot ${row.ok ? "" : "opacity-30 grayscale"}`} aria-hidden />
                      <span className="text-xs text-ink">{row.v}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="card p-6">
              <h2 className="text-2xl">Health</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">
                Open these on the live site to check a deployment without digging through logs.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <a href="/api/health/config" target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                  Configuration checklist
                </a>
                <a href="/api/health/db" target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                  Database ping
                </a>
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

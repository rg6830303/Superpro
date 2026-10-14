"use client";

import { useEffect, useState } from "react";
import { Award, X } from "lucide-react";
import { Drawer } from "@/components/admin/crud";
import { Alert, Spinner } from "@/components/ui";
import { BADGES, type UserBadge } from "@/lib/badges";
import { BadgeChip } from "@/components/badge-chip";

/** Award or remove a player's badges. Each award notifies the player. */
export function BadgeDrawer({ user, onClose }: { user: { id: string; full_name: string; email: string }; onClose: () => void }) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [badge, setBadge] = useState<string>(BADGES[0].key);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/badges?user_id=${user.id}`)
      .then((r) => r.json())
      .then((d) => setBadges(d.badges ?? []))
      .catch(() => setError("Could not load badges."))
      .finally(() => setLoading(false));
  }, [user.id]);

  async function call(method: "POST" | "DELETE", body?: object, id?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/badges${id ? `?id=${id}` : ""}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not update badges.");
      setBadges(data.badges ?? []);
      if (method === "POST") { setLabel(""); setNote(""); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update badges.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer title="Badges" sub={`${user.full_name} · ${user.email}`} onClose={onClose}>
      <p className="eyebrow">Current badges</p>
      {loading ? (
        <div className="mt-3"><Spinner /></div>
      ) : badges.length === 0 ? (
        <p className="mt-3 text-sm text-ink/55">No badges yet.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {badges.map((b) => (
            <li key={b.id} className="inline-flex items-center gap-1">
              <BadgeChip badge={b.badge} label={b.label} />
              <button type="button" disabled={busy} onClick={() => call("DELETE", undefined, b.id)} className="rounded-full p-1 text-ink/50 hover:bg-mist hover:text-signal" aria-label={`Remove ${b.label}`}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => { e.preventDefault(); call("POST", { user_id: user.id, badge, label: label || undefined, note: note || undefined }); }}
      >
        <p className="eyebrow">Award a badge</p>
        <label className="block text-sm font-semibold">
          Badge
          <select className="field mt-1" value={badge} onChange={(e) => setBadge(e.target.value)}>
            {BADGES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        </label>
        {badge === "custom" && (
          <label className="block text-sm font-semibold">
            Badge name
            <input className="field mt-1" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Monsoon Cup MVP" required />
          </label>
        )}
        <label className="block text-sm font-semibold">
          Note to the player <span className="font-normal text-ink/50">(optional)</span>
          <input className="field mt-1" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Shown in their notification" />
        </label>
        {error && <Alert tone="error">{error}</Alert>}
        <button type="submit" disabled={busy} className="btn-volt w-full">
          {busy ? <Spinner /> : <Award size={15} />} Award badge
        </button>
      </form>
    </Drawer>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, RefreshCw, Send } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { ListState, submitResource } from "@/components/admin/crud";
import { Alert, Spinner } from "@/components/ui";

type Message = {
  id: string;
  kind: string;
  target: "group" | "number";
  phone: string | null;
  message: string;
  status: "queued" | "sent" | "failed" | "skipped";
  channel: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

type Config = { hasRelay: boolean; hasCloudApi: boolean; hasGroupJid: boolean };

export default function AdminWhatsappPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [broadcast, setBroadcast] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (status = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/whatsapp${status ? `?status=${status}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the outbox.");
      setMessages(data.messages ?? []);
      setConfig(data.config ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the outbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [load, filter]);

  const queued = messages.filter((m) => m.status === "queued").length;
  const failed = messages.filter((m) => m.status === "failed").length;
  const automatic = Boolean(config?.hasRelay);

  async function sendBroadcast() {
    if (broadcast.trim().length < 3) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/admin/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "broadcast", message: broadcast }),
    });
    const data = await res.json();
    setBusy(false);
    setNotice(data.ok ? "Sent to the group." : "Queued below — send it with one tap.");
    setBroadcast("");
    load(filter);
  }

  return (
    <div>
      <AdminHeader
        title="WhatsApp"
        sub="Everything the site has sent, and anything still waiting to go out."
        action={
          <button type="button" onClick={() => load(filter)} className="btn-outline btn-sm">
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Waiting to send" value={queued} tone={queued > 0 ? "accent" : "default"} />
        <StatTile label="Failed" value={failed} tone={failed > 0 ? "warn" : "default"} />
        <StatTile label="Delivery" value={automatic ? "Automatic" : "Manual"} hint={automatic ? "Relay configured" : "One tap per message"} />
      </div>

      {!automatic && (
        <div className="mb-6">
          <Alert tone="info">
            WhatsApp&apos;s official API cannot post into a group chat, and no relay is configured — so group
            messages queue here and go out with one tap on <strong>Open in WhatsApp</strong>. Set
            WHATSAPP_WEBHOOK_URL to make this automatic.
          </Alert>
        </div>
      )}

      <div className="card mb-6 p-5">
        <h2 className="text-xl">Message the games group</h2>
        <textarea
          rows={3}
          className="field mt-3 resize-none"
          value={broadcast}
          onChange={(e) => setBroadcast(e.target.value)}
          placeholder="Courts are wet — tonight's 7 PM slot is moving indoors."
          aria-label="Broadcast message"
        />
        <button type="button" onClick={sendBroadcast} disabled={busy || broadcast.trim().length < 3} className="btn-volt btn-sm mt-3">
          {busy ? <Spinner size={13} /> : <Send size={13} />} Send to group
        </button>
        {notice && <p className="mt-3 text-xs text-volt-deep">{notice}</p>}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {["", "queued", "sent", "failed"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              filter === s ? "bg-volt text-ink" : "border border-line text-ink/70 hover:text-ink"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <ListState loading={loading} error={error} empty={messages.length === 0} emptyLabel="Nothing sent yet." />

      {!loading && messages.length > 0 && (
        <div className="space-y-3">
          {messages.map((m) => {
            const link = m.target === "number" && m.phone
              ? `https://wa.me/${m.phone.replace(/\D/g, "")}?text=${encodeURIComponent(m.message)}`
              : `https://wa.me/?text=${encodeURIComponent(m.message)}`;
            return (
              <div key={m.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={m.status === "sent" ? "chip-volt" : m.status === "failed" ? "chip-volt" : "chip"}>
                      {m.status}
                    </span>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
                      {m.kind.replace(/_/g, " ")} · {m.target === "group" ? "Games group" : m.phone}
                    </p>
                    <p className="text-[11px] text-ink/45">
                      {new Date(m.created_at).toLocaleString("en-IN")}
                      {m.channel ? ` · via ${m.channel}` : ""}
                    </p>
                  </div>

                  {m.status !== "sent" && (
                    <div className="flex gap-2">
                      <a href={link} target="_blank" rel="noopener noreferrer" className="btn-volt btn-sm">
                        <ExternalLink size={13} /> Open in WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          await submitResource("/api/admin/whatsapp", "POST", { action: "mark_sent", id: m.id });
                          load(filter);
                        }}
                        className="btn-outline btn-sm"
                        title="Mark as sent once you have posted it"
                      >
                        <Check size={13} /> Done
                      </button>
                    </div>
                  )}
                </div>

                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-mist p-4 font-sans text-xs leading-relaxed text-ink/75">
                  {m.message}
                </pre>

                {m.error && <p className="mt-2 text-xs text-signal">{m.error}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

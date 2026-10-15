"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, PartyPopper, Trophy } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import { useRazorpayPreload } from "@/components/razorpay-client";
import { payForRegistration, type PayStart } from "@/components/coaching-pay";
import { formatPaise } from "@/lib/money";
import { OPEN, OPEN_CATEGORIES, categoryBlock, earlyBirdPaise, playerBlock, totalPaise, type EntryInput } from "@/lib/sparvic-open";

type Profile = { name: string; email: string; phone: string; gender: string | null; dupr: number | null; dupr_id: string | null };
type Entry = { reference: string; categories: EntryInput[]; amount_paise: number; payment_status: string; created_at: string };
type Partner = { name: string; phone: string; dupr: string };

const label = (id: string) => OPEN_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/**
 * Clubhouse registration for the Sparvic Open: details come from the profile,
 * the player ticks any categories they're eligible for (the total follows),
 * adds a partner for doubles, and pays on Razorpay to confirm.
 */
export function SparvicOpenForm({ profile, entries, razorpayEnabled, earlyBird = false }: { profile: Profile; entries: Entry[]; razorpayEnabled: boolean; earlyBird?: boolean }) {
  useRazorpayPreload(razorpayEnabled);
  const router = useRouter();
  const [dupr, setDupr] = useState(profile.dupr != null ? String(profile.dupr) : "");
  const [duprId, setDuprId] = useState(profile.dupr_id ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [partners, setPartners] = useState<Record<string, Partner>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const facts = { dupr: dupr === "" ? null : Number(dupr), gender: profile.gender };
  const blocked = playerBlock(facts);
  const paid = useMemo(
    () => new Set(entries.filter((e) => e.payment_status === "paid").flatMap((e) => e.categories.map((c) => c.category))),
    [entries],
  );
  const gross = totalPaise(picked);
  const discount = earlyBirdPaise(gross, earlyBird);
  const total = gross - discount;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const setPartner = (id: string, k: keyof Partner, v: string) =>
    setPartners((p) => ({ ...p, [id]: { ...(p[id] ?? { name: "", phone: "", dupr: "" }), [k]: v } }));

  async function pay(start: PayStart & { description?: string }) {
    const outcome = await payForRegistration(start, { kind: "sparvic_open", name: OPEN.name, description: start.description });
    if (outcome === "paid" || outcome === "failed") {
      // Paid: confirmed. Failed verification: the page shows "pending" and
      // explains, and the webhook-free recheck happens when it loads.
      router.push(`/dashboard/sparvic-open/confirmation/${start.reference}`);
    } else {
      router.refresh();
    }
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/sparvic-open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dupr: profile.dupr == null && dupr ? Number(dupr) : undefined,
          dupr_id: profile.dupr == null ? duprId || undefined : undefined,
          entries: picked.map((id) => {
            const cat = OPEN_CATEGORIES.find((c) => c.id === id)!;
            const p = partners[id];
            return cat.type === "doubles"
              ? { category: id, partner_name: p?.name ?? "", partner_phone: (p?.phone ?? "").replace(/\D/g, ""), partner_dupr: p?.dupr ? Number(p.dupr) : null }
              : { category: id };
          }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start the registration.");
      await pay(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the registration.");
    } finally {
      setBusy(false);
    }
  }

  async function payLater(reference: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/sparvic-open/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start the payment.");
      await pay(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {done && (
        <div className="card flex items-start gap-3 p-5">
          <PartyPopper className="shrink-0 text-volt-deep" size={22} />
          <div>
            <p className="font-semibold text-ink">You&apos;re registered! Entry {done} is confirmed.</p>
            <p className="text-sm text-ink/65">We&apos;ve sent the details to your notifications. Fixtures will follow on Sparvic.</p>
          </div>
        </div>
      )}

      {earlyBird && (
        <div className="so-earlybird">🎉 Congratulations! You joined Sparvic before launch, so you get an early-bird {OPEN.earlyBirdPct}% off your tournament total. The discount is applied at payment.</div>
      )}

      <section className="card p-5 sm:p-6">
        <p className="eyebrow">Your details (from your profile)</p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-ink/50">Name</dt><dd className="font-semibold text-ink">{profile.name}</dd></div>
          <div><dt className="text-ink/50">Phone</dt><dd className="font-semibold text-ink">{profile.phone || "—"}</dd></div>
          <div><dt className="text-ink/50">Email</dt><dd className="font-semibold text-ink break-all">{profile.email}</dd></div>
          <div><dt className="text-ink/50">Gender</dt><dd className="font-semibold capitalize text-ink">{profile.gender ?? "Not set"}</dd></div>
        </dl>
        {profile.dupr != null ? (
          <p className="mt-3 text-sm text-ink/70">DUPR <strong className="font-mono text-ink">{Number(profile.dupr).toFixed(2)}</strong>{profile.dupr_id ? ` · ID ${profile.dupr_id}` : ""}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Your DUPR rating
              <input className="field mt-1" inputMode="decimal" value={dupr} onChange={(e) => setDupr(e.target.value)} placeholder="e.g. 3.45" />
            </label>
            <label className="block text-sm font-semibold">DUPR ID <span className="font-normal text-ink/50">(optional)</span>
              <input className="field mt-1" value={duprId} onChange={(e) => setDuprId(e.target.value)} placeholder="e.g. ABC123" />
            </label>
          </div>
        )}
        <Link href="/dashboard/profile" className="mt-3 inline-block text-xs font-semibold text-volt-deep hover:underline">Edit profile</Link>
      </section>

      {blocked ? (
        <Alert tone="error">{blocked}</Alert>
      ) : (
        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Pick your categories</p>
          <p className="mt-1 text-sm text-ink/60">Enter as many as you&apos;re eligible for. Doubles fees are per team.</p>
          {(["singles", "doubles"] as const).map((type) => (
            <div key={type} className="mt-5">
              <p className="text-sm font-semibold capitalize text-ink">{type}</p>
              <div className="mt-2 grid gap-2">
                {OPEN_CATEGORIES.filter((c) => c.type === type).map((c) => {
                  const why = paid.has(c.id) ? "Already entered" : categoryBlock(c, facts);
                  const on = picked.includes(c.id);
                  const p = partners[c.id];
                  return (
                    <div key={c.id} className={`so-cat ${on ? "is-on" : ""} ${why ? "is-off" : ""}`}>
                      <button type="button" disabled={Boolean(why)} onClick={() => toggle(c.id)} aria-pressed={on} className="so-cat-head">
                        <span className="so-check">{on ? <Check size={14} /> : null}</span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block text-sm font-semibold text-ink">{c.label}</span>
                          <span className="block text-[11px] text-ink/55">{why ?? `Gold ₹${c.gold.toLocaleString("en-IN")} · Silver ₹${c.silver.toLocaleString("en-IN")}`}</span>
                        </span>
                        <span className="font-mono text-sm font-bold text-ink">{formatPaise(c.feePaise)}</span>
                      </button>
                      {on && c.type === "doubles" && (
                        <div className="so-partner">
                          <input className="field" placeholder={c.gender === "mixed" ? "Partner's name (opposite gender)" : "Partner's name"} value={p?.name ?? ""} onChange={(e) => setPartner(c.id, "name", e.target.value)} />
                          <input className="field" inputMode="numeric" maxLength={10} placeholder="Partner's phone" value={p?.phone ?? ""} onChange={(e) => setPartner(c.id, "phone", e.target.value.replace(/\D/g, ""))} />
                          <input className="field" inputMode="decimal" placeholder={`Partner's DUPR (under ${c.band})`} value={p?.dupr ?? ""} onChange={(e) => setPartner(c.id, "dupr", e.target.value)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {!blocked && (
        <div className="so-paybar">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink/55">{picked.length} categor{picked.length === 1 ? "y" : "ies"}</p>
            <p className="font-display text-2xl text-ink">{formatPaise(total)}</p>
            {discount > 0 && <p className="text-[11px] font-semibold text-volt-deep"><s className="text-ink/40">{formatPaise(gross)}</s> · Early bird −{OPEN.earlyBirdPct}%</p>}
          </div>
          <button type="button" className="btn-volt" disabled={busy || picked.length === 0 || !razorpayEnabled} onClick={submit}>
            {busy ? <Spinner /> : <Trophy size={16} />} Pay {picked.length ? formatPaise(total) : ""} &amp; confirm
          </button>
        </div>
      )}
      {!razorpayEnabled && <p className="text-xs text-ink/55"><CircleAlert size={12} className="inline" /> Online payment is unavailable right now. Call {OPEN.contactDisplay}.</p>}

      {entries.length > 0 && (
        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Your entries</p>
          <ul className="mt-3 divide-y divide-ink/5">
            {entries.map((e) => (
              <li key={e.reference} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-volt-deep">{e.reference}</p>
                  <p className="text-sm font-semibold text-ink">{e.categories.map((c) => label(c.category)).join(" · ")}</p>
                  {e.categories.filter((c) => c.partner_name).map((c) => (
                    <p key={c.category} className="text-[11px] text-ink/55">Partner ({label(c.category).split(" DUPR")[0]}): {c.partner_name}</p>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">{formatPaise(e.amount_paise)}</span>
                  {e.payment_status === "paid" ? (
                    <span className="chip-volt">Confirmed</span>
                  ) : (
                    <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => payLater(e.reference)}>Pay now</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

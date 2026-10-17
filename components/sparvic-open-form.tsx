"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Clock, Handshake, Search, Send, Trophy, UserPlus, X } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import { Avatar, FollowButton } from "@/components/player-directory";
import { useRazorpayPreload } from "@/components/razorpay-client";
import { payForRegistration, type PayStart } from "@/components/coaching-pay";
import { formatPaise } from "@/lib/money";
import { OPEN, OPEN_CATEGORIES, PAIRING_ENABLED, categoryBlock, earlyBirdPaise, manualPartnerBlock, playerBlock, ratingFor, totalPaise, type EntryInput, type OpenCategory } from "@/lib/sparvic-open";

type Profile = { id: string; name: string; email: string; phone: string; gender: string | null; dupr: number | null; dupr_singles: number | null; dupr_doubles: number | null; dupr_id: string | null };
type Entry = { reference: string; categories: EntryInput[]; amount_paise: number; payment_status: string; created_at: string; as_partner?: boolean; player_name?: string };
export type Pair = {
  id: string; category: string; status: "pending" | "accepted" | "declined" | "cancelled"; message: string | null; team_entry_ref: string | null;
  created_at: string; direction: "incoming" | "outgoing"; other_id: string; other_name: string; other_handle: string | null; other_avatar: string | null; other_dupr_doubles: number | null;
};
type Candidate = { id: string; name: string; handle: string | null; avatar_url: string | null; dupr_doubles: number | null; rank: number | null; eligible: boolean; reason: string | null };

const label = (id: string) => OPEN_CATEGORIES.find((c) => c.id === id)?.label ?? id;
const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
type Manual = { name: string; duprId: string; dupr: string; phone: string; email: string };
const EMPTY: Manual = { name: "", duprId: "", dupr: "", phone: "", email: "" };
const manualEntry = (id: string, m: Manual = EMPTY): EntryInput => ({
  category: id, partner_name: m.name.trim(), partner_dupr_id: m.duprId.trim(), partner_dupr: toNum(m.dupr),
  partner_phone: m.phone.replace(/\D/g, ""), partner_email: m.email.trim(),
});

/**
 * Clubhouse registration for the Sparvic Open.
 * - Ratings: DUPR singles and doubles are separate; each category checks its own.
 * - Doubles: search registered Sparvic players (with club rank), send a partner
 *   request; once the partner accepts, either of you can register and pay.
 * - Requests you receive pile up at the top; accept the ones you want.
 * - Any category can be added later; nothing is confirmed until it's paid.
 */
export function SparvicOpenForm({ profile, entries, pairs, razorpayEnabled, earlyBird = false, walletPaise = 0 }: { profile: Profile; entries: Entry[]; pairs: Pair[]; razorpayEnabled: boolean; earlyBird?: boolean; walletPaise?: number }) {
  useRazorpayPreload(razorpayEnabled);
  const router = useRouter();
  const [singles, setSingles] = useState(profile.dupr_singles != null ? String(profile.dupr_singles) : profile.dupr != null ? String(profile.dupr) : "");
  const [doubles, setDoubles] = useState(profile.dupr_doubles != null ? String(profile.dupr_doubles) : profile.dupr != null ? String(profile.dupr) : "");
  const [savedRatings, setSavedRatings] = useState({ s: singles, d: doubles });
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState<Record<string, Manual>>({});
  const [method, setMethod] = useState<"online" | "wallet">(razorpayEnabled ? "online" : "wallet");
  const setPartner = (id: string, k: keyof Manual, v: string) => setManual((m) => ({ ...m, [id]: { ...(m[id] ?? EMPTY), [k]: v } }));
  const [acceptedNow, setAcceptedNow] = useState<{ category: string; partner: { id: string; name: string; handle: string | null }; following: boolean } | null>(null);

  const facts = { dupr: profile.dupr, dupr_singles: toNum(singles), dupr_doubles: toNum(doubles), gender: profile.gender };
  const ratingsDirty = singles !== savedRatings.s || doubles !== savedRatings.d;
  const blocked = playerBlock(facts);

  const paid = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) if (e.payment_status === "paid") for (const c of e.categories) if (!e.as_partner || c.partner_user_id === profile.id) s.add(c.category);
    return s;
  }, [entries, profile.id]);
  const accepted = (cat: string) => pairs.find((p) => p.category === cat && p.status === "accepted" && !p.team_entry_ref);
  const waiting = (cat: string) => pairs.filter((p) => p.category === cat && p.status === "pending" && p.direction === "outgoing");
  const incoming = PAIRING_ENABLED ? pairs.filter((p) => p.direction === "incoming" && p.status === "pending") : [];
  const partners = PAIRING_ENABLED ? pairs.filter((p) => p.status === "accepted") : [];

  const gross = totalPaise(picked);
  const discount = earlyBirdPaise(gross, earlyBird);
  const total = gross - discount;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function call(url: string, method: string, body: object) {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }
  const run = async (key: string, fn: () => Promise<void>) => {
    setError(null); setNotice(null); setBusy(key);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(null); }
  };

  const saveRatings = () => run("ratings", async () => {
    await call("/api/sparvic-open/ratings", "POST", { dupr_singles: toNum(singles), dupr_doubles: toNum(doubles) });
    setSavedRatings({ s: singles, d: doubles });
    setNotice("Ratings saved to your profile.");
    router.refresh();
  });

  const respond = (p: Pair, action: "accept" | "decline" | "cancel") => run(`${action}-${p.id}`, async () => {
    const data = await call("/api/sparvic-open/pairs", "PATCH", { id: p.id, action });
    if (action === "accept") {
      setAcceptedNow({ category: data.category, partner: data.partner, following: data.following });
      setPicked((x) => (x.includes(data.category) ? x : [...x, data.category]));
    } else setNotice(action === "decline" ? "Request declined." : "Pairing withdrawn.");
    router.refresh();
  });

  async function pay(start: PayStart & { description?: string }) {
    const outcome = await payForRegistration(start, { kind: "sparvic_open", name: OPEN.name, description: start.description });
    if (outcome === "paid" || outcome === "failed") router.push(`/dashboard/sparvic-open/confirmation/${start.reference}`);
    else router.refresh();
  }

  const submit = () => run("pay", async () => {
    if (!PAIRING_ENABLED) {
      for (const id of picked) {
        const cat = OPEN_CATEGORIES.find((c) => c.id === id)!;
        const why = cat.type === "doubles" ? manualPartnerBlock(cat, manualEntry(id, manual[id])) : null;
        if (why) throw new Error(`${cat.label}: ${why}`);
      }
    }
    const data = await call("/api/sparvic-open", "POST", {
      pay_method: method,
      dupr_singles: toNum(singles),
      dupr_doubles: toNum(doubles),
      entries: picked.map((id) => {
        const cat = OPEN_CATEGORIES.find((c) => c.id === id)!;
        if (cat.type !== "doubles") return { category: id };
        return PAIRING_ENABLED ? { category: id, partner_user_id: accepted(id)?.other_id } : manualEntry(id, manual[id]);
      }),
    });
    if (data.paid_via === "wallet") { router.push(`/dashboard/sparvic-open/confirmation/${data.reference}`); return; }
    await pay(data);
  });

  const payLater = (reference: string, via: "online" | "wallet" = "online") => run(`later-${reference}`, async () => {
    const data = await call("/api/sparvic-open/pay", "POST", { reference, pay_method: via });
    if (data.paid_via === "wallet") { router.push(`/dashboard/sparvic-open/confirmation/${data.reference}`); return; }
    await pay(data);
  });

  return (
    <div className="so-layout">
    <div className="so-main space-y-5">
      {earlyBird && <div className="so-earlybird">🎉 Congratulations! You joined Sparvic before launch, so you get an early-bird {OPEN.earlyBirdPct}% off your tournament total. The discount is applied at payment.</div>}

      {paid.size > 0 && !blocked && (() => {
        const open = OPEN_CATEGORIES.filter((c) => !paid.has(c.id) && !categoryBlock(c, facts));
        return (
          <section className="so-accepted">
            <p className="font-semibold text-ink">You&apos;re confirmed in {[...paid].map(label).join(", ")}.</p>
            <p className="mt-1 text-sm text-ink/65">
              {open.length
                ? `Your DUPR also fits ${open.length} more categor${open.length === 1 ? "y" : "ies"}: ${open.map((c) => c.label).join(", ")}. Tick them below to add them to your registration.`
                : "There are no other categories your DUPR fits right now."}
            </p>
          </section>
        );
      })()}

      {/* Requests waiting for you */}
      {incoming.length > 0 && (
        <section className="so-requests">
          <p className="so-requests-head"><Handshake size={16} /> {incoming.length} partner request{incoming.length === 1 ? "" : "s"} for you</p>
          <ul className="mt-3 space-y-2">
            {incoming.map((p) => (
              <li key={p.id} className="so-req">
                <Avatar name={p.other_name} src={p.other_avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{p.other_name}</p>
                  <p className="text-[11px] text-ink/60">{label(p.category)}{p.other_dupr_doubles != null ? ` · doubles DUPR ${Number(p.other_dupr_doubles).toFixed(2)}` : ""}</p>
                  {p.message && <p className="mt-1 text-xs italic text-ink/60">“{p.message}”</p>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" className="btn-volt btn-sm" disabled={!!busy} onClick={() => respond(p, "accept")}>{busy === `accept-${p.id}` ? <Spinner /> : <Check size={14} />} Accept</button>
                  <button type="button" className="btn-outline btn-sm" disabled={!!busy} onClick={() => respond(p, "decline")} aria-label="Decline"><X size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink/55">Accept as many as you like across categories (one partner per category). After accepting, register the team below; either partner can pay.</p>
        </section>
      )}

      {acceptedNow && (
        <section className="so-accepted">
          <p className="font-semibold text-ink">You&apos;re paired with {acceptedNow.partner.name} for {label(acceptedNow.category)}.</p>
          <p className="mt-1 text-sm text-ink/65">It&apos;s ticked below: complete the team registration and payment now to lock your place.</p>
          {!acceptedNow.following && acceptedNow.partner.handle && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink/70">
              <span>Follow your partner to see when they&apos;re on court:</span>
              <FollowButton handle={acceptedNow.partner.handle} initialFollowing={false} initialFollowers={0} followsMe={false} signedIn />
            </div>
          )}
        </section>
      )}

      {/* Details and ratings */}
      <section className="card p-5 sm:p-6">
        <p className="so-step"><span>1</span> Your details</p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-ink/50">Name</dt><dd className="font-semibold text-ink">{profile.name}</dd></div>
          <div><dt className="text-ink/50">Phone</dt><dd className="font-semibold text-ink">{profile.phone || "—"}</dd></div>
          <div><dt className="text-ink/50">Email</dt><dd className="break-all font-semibold text-ink">{profile.email}</dd></div>
          <div><dt className="text-ink/50">Gender</dt><dd className="font-semibold capitalize text-ink">{profile.gender ?? "Not set"}</dd></div>
        </dl>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">DUPR singles
            <input className="field mt-1" inputMode="decimal" value={singles} onChange={(e) => setSingles(e.target.value)} placeholder="e.g. 3.56" />
          </label>
          <label className="block text-sm font-semibold">DUPR doubles
            <input className="field mt-1" inputMode="decimal" value={doubles} onChange={(e) => setDoubles(e.target.value)} placeholder="e.g. 3.80" />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-ink/55">DUPR rates singles and doubles separately: singles categories use your singles rating, doubles use your doubles rating (as on {OPEN.duprAsOf}). Ratings are verified by the organisers.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {ratingsDirty && <button type="button" className="btn-volt btn-sm" disabled={!!busy} onClick={saveRatings}>{busy === "ratings" ? <Spinner /> : null} Save ratings</button>}
          <Link href="/dashboard/profile" className="text-xs font-semibold text-volt-deep hover:underline">Edit profile</Link>
        </div>
      </section>

      {notice && <Alert tone="ok">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {blocked ? (
        <Alert tone="error">{blocked}</Alert>
      ) : (
        <section className="card p-5 sm:p-6">
          <p className="so-step"><span>2</span> Pick your categories</p>
          <p className="mt-1 text-sm text-ink/60">Add as many as you&apos;re eligible for, now or later. Doubles fees are per team; a place is confirmed only once it&apos;s paid.</p>
          {(["singles", "doubles"] as const).map((type) => (
            <div key={type} className="mt-5">
              <p className="text-sm font-semibold capitalize text-ink">{type} <span className="font-normal normal-case text-ink/50">· your {type} DUPR {ratingFor(type, facts)?.toFixed(2) ?? "not set"}</span></p>
              <div className="mt-2 grid gap-2">
                {OPEN_CATEGORIES.filter((c) => c.type === type).map((c) => (
                  <CategoryRow
                    key={c.id}
                    cat={c}
                    why={paid.has(c.id) ? "Confirmed" : categoryBlock(c, facts)}
                    confirmed={paid.has(c.id)}
                    on={picked.includes(c.id)}
                    toggle={() => toggle(c.id)}
                    accepted={accepted(c.id)}
                    waiting={waiting(c.id)}
                    ratingsDirty={ratingsDirty}
                    busy={busy}
                    onCancel={(p) => respond(p, "cancel")}
                    onSent={(name) => { setNotice(`Request sent to ${name}. You'll be notified when they respond.`); router.refresh(); }}
                    onError={setError}
                    manual={manual[c.id] ?? EMPTY}
                    setPartner={(k, v) => setPartner(c.id, k, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {!razorpayEnabled && <p className="text-xs text-ink/55"><CircleAlert size={12} className="inline" /> Online payment is unavailable right now. Call {OPEN.contactDisplay}.</p>}

      {entries.length > 0 && (
        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Your entries</p>
          <ul className="mt-3 divide-y divide-ink/5">
            {entries.map((e) => (
              <li key={e.reference} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-volt-deep">{e.reference}{e.as_partner ? ` · registered by ${e.player_name}` : ""}</p>
                  <p className="text-sm font-semibold text-ink">{(e.as_partner ? e.categories.filter((c) => c.partner_user_id === profile.id) : e.categories).map((c) => label(c.category)).join(" · ")}</p>
                  {!e.as_partner && e.categories.filter((c) => c.partner_name).map((c) => (
                    <p key={c.category} className="text-[11px] text-ink/55">Partner ({label(c.category).split(" DUPR")[0]}): {c.partner_name}</p>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {!e.as_partner && <span className="font-mono text-sm">{formatPaise(e.amount_paise)}</span>}
                  {e.payment_status === "paid" ? <Link href={`/dashboard/sparvic-open/confirmation/${e.reference}`} className="chip-volt">Confirmed</Link>
                    : <span className="flex gap-1.5">
                        <button type="button" className="btn-outline btn-sm" disabled={!!busy || !razorpayEnabled} onClick={() => payLater(e.reference)}>Pay online</button>
                        <button type="button" className="btn-outline btn-sm" disabled={!!busy || walletPaise < e.amount_paise} onClick={() => payLater(e.reference, "wallet")} title={walletPaise < e.amount_paise ? "Not enough in your wallet" : undefined}>Wallet</button>
                      </span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {partners.length > 0 && (
        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Your tournament partners</p>
          <ul className="mt-3 space-y-2">
            {partners.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Avatar name={p.other_name} src={p.other_avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{p.other_name}</p>
                  <p className="text-[11px] text-ink/55">{label(p.category)} · {p.team_entry_ref ? `team registered (${p.team_entry_ref})` : "paired, awaiting payment"}</p>
                </div>
                {p.other_handle && <Link href={`/dashboard/players/${p.other_handle}`} className="text-xs font-semibold text-volt-deep hover:underline">Profile</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
    {!blocked && (
      <aside className={`so-summary ${picked.length ? "" : "is-empty"}`} aria-label="Order summary">
        <p className="so-step"><span>3</span> Review &amp; pay</p>
        {picked.length === 0 ? (
          <p className="mt-3 text-sm text-ink/55">Tick the categories you want to enter and your total appears here.</p>
        ) : (
          <ul className="so-lines">
            {picked.map((id) => {
              const cat = OPEN_CATEGORIES.find((c) => c.id === id)!;
              return (
                <li key={id}>
                  <span className="min-w-0 flex-1 truncate">{cat.label}</span>
                  <span className="font-mono">{formatPaise(cat.feePaise)}</span>
                  <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${cat.label}`}><X size={13} /></button>
                </li>
              );
            })}
          </ul>
        )}
        {discount > 0 && (
          <p className="so-line-discount"><span>Early bird {OPEN.earlyBirdPct}% off</span><span className="font-mono">−{formatPaise(discount)}</span></p>
        )}
        <div className="so-total">
          <span className="so-total-label">{picked.length} categor{picked.length === 1 ? "y" : "ies"}</span>
          <span className="so-total-amount">{formatPaise(total)}</span>
        </div>
        <div className="so-methods" role="radiogroup" aria-label="How do you want to pay?">
          <button type="button" role="radio" aria-checked={method === "online"} disabled={!razorpayEnabled} onClick={() => setMethod("online")}>
            <span>Pay online</span><small>UPI, cards, net banking</small>
          </button>
          <button type="button" role="radio" aria-checked={method === "wallet"} onClick={() => setMethod("wallet")}>
            <span>Sparvic Wallet</span><small className={walletPaise < total ? "text-signal" : undefined}>Balance {formatPaise(walletPaise)}</small>
          </button>
        </div>
        {method === "wallet" && picked.length > 0 && walletPaise < total && (
          <p className="so-wallet-short">Your wallet is {formatPaise(total - walletPaise)} short. <Link href="/dashboard/wallet">Top up</Link> or pay online.</p>
        )}
        <button type="button" className="btn-volt so-pay" disabled={!!busy || picked.length === 0 || (method === "online" ? !razorpayEnabled : walletPaise < total)} onClick={submit}>
          {busy === "pay" ? <Spinner /> : <Trophy size={16} />} {method === "wallet" ? "Pay from wallet" : "Pay"} {picked.length ? formatPaise(total) : ""} &amp; confirm
        </button>
        <p className="so-fine">{method === "wallet" ? "Deducted from your Sparvic Wallet instantly; your place is confirmed right away." : "Secure online payment. Your place is confirmed once payment goes through."}</p>
      </aside>
    )}
    </div>
  );
}

/** One category: tick to register; doubles also handle the partner request. */
function CategoryRow({ cat, why, confirmed, on, toggle, accepted, waiting, ratingsDirty, busy, onCancel, onSent, onError, manual, setPartner }: {
  cat: OpenCategory; why: string | null; confirmed: boolean; on: boolean; toggle: () => void; accepted?: Pair; waiting: Pair[];
  ratingsDirty: boolean; busy: string | null; onCancel: (p: Pair) => void; onSent: (name: string) => void; onError: (m: string) => void;
  manual: Manual; setPartner: (k: keyof Manual, v: string) => void;
}) {
  const doubles = cat.type === "doubles";
  const ready = !why && (!doubles || !PAIRING_ENABLED || Boolean(accepted));
  const [open, setOpen] = useState(false);
  return (
    <div className={`so-cat ${on ? "is-on" : ""} ${why && !confirmed ? "is-off" : ""} ${confirmed ? "is-done" : ""}`}>
      <button type="button" disabled={!ready} onClick={toggle} aria-pressed={on} className="so-cat-head">
        <span className="so-check">{on || confirmed ? <Check size={14} /> : null}</span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-ink">{cat.label}</span>
          <span className="block text-[11px] text-ink/55">
            {why ?? (doubles && !PAIRING_ENABLED ? (on ? "Add your partner's details below" : `Per team · Gold ₹${cat.gold.toLocaleString("en-IN")}`) : doubles ? (accepted ? `With ${accepted.other_name} ✓` : waiting.length ? `Waiting for ${waiting.map((w) => w.other_name.split(" ")[0]).join(", ")}` : "Find a partner to register") : `Gold ₹${cat.gold.toLocaleString("en-IN")} · Silver ₹${cat.silver.toLocaleString("en-IN")}`)}
          </span>
        </span>
        <span className="font-mono text-sm font-bold text-ink">{formatPaise(cat.feePaise)}</span>
      </button>
      {doubles && !PAIRING_ENABLED && on && (
        <div className="so-manual">
          <p className="so-manual-title">Your partner{cat.gender === "mixed" ? " (opposite gender)" : cat.gender === "women" ? " (female)" : " (male)"}</p>
          <label>Full name<input className="field" value={manual.name} onChange={(e) => setPartner("name", e.target.value)} autoComplete="off" placeholder="Partner's full name" /></label>
          <div className="so-manual-row">
            <label>DUPR ID<input className="field" value={manual.duprId} onChange={(e) => setPartner("duprId", e.target.value)} placeholder="e.g. ABC123" /></label>
            <label>Doubles DUPR<input className="field" inputMode="decimal" value={manual.dupr} onChange={(e) => setPartner("dupr", e.target.value)} placeholder={`under ${cat.band}`} /></label>
          </div>
          <label>Phone<input className="field" inputMode="numeric" maxLength={10} value={manual.phone} onChange={(e) => setPartner("phone", e.target.value.replace(/\D/g, ""))} placeholder="10-digit mobile" /></label>
          <label>Email<input className="field" type="email" inputMode="email" value={manual.email} onChange={(e) => setPartner("email", e.target.value)} placeholder="partner@email.com" /></label>
        </div>
      )}
      {PAIRING_ENABLED && doubles && !why && !confirmed && (
        <div className="so-partner-zone">
          {accepted ? (
            <p className="flex items-center justify-between gap-2 text-xs text-ink/70">
              <span><Check size={12} className="inline text-volt-deep" /> Paired with <strong>{accepted.other_name}</strong>. Tick the category to pay the team entry.</span>
              <button type="button" className="text-signal hover:underline" disabled={!!busy} onClick={() => onCancel(accepted)}>Withdraw</button>
            </p>
          ) : (
            <>
              {waiting.map((w) => (
                <p key={w.id} className="flex items-center justify-between gap-2 text-xs text-ink/70">
                  <span><Clock size={12} className="inline" /> Request sent to <strong>{w.other_name}</strong>: waiting for them to accept.</span>
                  <button type="button" className="text-signal hover:underline" disabled={!!busy} onClick={() => onCancel(w)}>Cancel</button>
                </p>
              ))}
              {open ? (
                <PartnerSearch cat={cat} ratingsDirty={ratingsDirty} onClose={() => setOpen(false)} onSent={(n) => { setOpen(false); onSent(n); }} onError={onError} exclude={waiting.map((w) => w.other_id)} />
              ) : (
                <button type="button" className="btn-outline btn-sm mt-1" onClick={() => setOpen(true)}><UserPlus size={14} /> {waiting.length ? "Ask someone else" : "Find a Sparvic partner"}</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Search registered players for this doubles category, ranked, with eligibility. */
function PartnerSearch({ cat, ratingsDirty, onClose, onSent, onError, exclude }: {
  cat: OpenCategory; ratingsDirty: boolean; onClose: () => void; onSent: (name: string) => void; onError: (m: string) => void; exclude: string[];
}) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sparvic-open/partners?category=${cat.id}&q=${encodeURIComponent(term)}`, { cache: "no-store" });
      const data = await res.json();
      setList(data.players ?? []);
    } finally { setLoading(false); }
  }, [cat.id]);
  useEffect(() => { const t = setTimeout(() => load(q.trim()), q ? 250 : 0); return () => clearTimeout(t); }, [q, load]);

  async function send(c: Candidate) {
    if (ratingsDirty) return onError("Save your ratings first, then send the request.");
    setSending(c.id);
    try {
      const res = await fetch("/api/sparvic-open/pairs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: cat.id, partner_id: c.id, message: message || undefined }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send the request.");
      onSent(c.name);
    } catch (e) { onError(e instanceof Error ? e.message : "Could not send the request."); } finally { setSending(null); }
  }

  return (
    <div className="so-search">
      <div className="flex items-center gap-2">
        <label className="so-search-box"><Search size={14} /><input data-native value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Sparvic players" aria-label="Search Sparvic players" /></label>
        <button type="button" className="demo-passport-btn" onClick={onClose} aria-label="Close search"><X size={15} /></button>
      </div>
      <input className="field mt-2" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} placeholder="Add a note (optional)" />
      <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-ink/50">Ranked by Sparvic leaderboard · doubles DUPR must be under {cat.band}</p>
      {loading ? <div className="py-3"><Spinner /></div> : list.length === 0 ? <p className="py-3 text-xs text-ink/55">No players found.</p> : (
        <ol className="so-cands">
          {list.filter((c) => !exclude.includes(c.id)).map((c) => (
            <li key={c.id} className={c.eligible ? "" : "is-off"}>
              <span className="so-rank">{c.rank ?? "—"}</span>
              <Avatar name={c.name} src={c.avatar_url} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                <span className="block text-[11px] text-ink/55">{c.eligible ? `Doubles DUPR ${c.dupr_doubles?.toFixed(2) ?? "—"}` : c.reason}</span>
              </span>
              <button type="button" className="btn-volt btn-sm" disabled={!c.eligible || !!sending} onClick={() => send(c)} title={c.reason ?? undefined}>
                {sending === c.id ? <Spinner /> : <Send size={13} />} Request
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

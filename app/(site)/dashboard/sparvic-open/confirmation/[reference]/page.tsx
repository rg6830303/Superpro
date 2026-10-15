import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, MapPin, PartyPopper, Phone } from "lucide-react";
import { getPlayerSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { formatPaise } from "@/lib/money";
import { OPEN, OPEN_CATEGORIES } from "@/lib/sparvic-open";
import { afterEntryPaid, markOpenEntryPaid, type OpenEntry } from "@/lib/sparvic-open-server";
import { capturedPayment, fetchOrderPayments, isRazorpayEnabled } from "@/lib/razorpay";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Registration confirmed · Sparvic Open", robots: { index: false } };

/** Where Razorpay hands the player back after paying: their entry, confirmed. */
export default async function OpenConfirmationPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const session = await getPlayerSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/dashboard/sparvic-open/confirmation/${reference}`)}`);
  if (!/^SO-[A-F0-9]{8}$/.test(reference)) notFound();
  await ensureSchema();
  let e = await queryOne<OpenEntry & { discount_paise: number }>(
    `SELECT * FROM open_entries WHERE reference = $1 AND (user_id = $2 OR categories @> $3::jsonb)`,
    [reference, session.id, JSON.stringify([{ partner_user_id: session.id }])],
  );
  if (!e) notFound();
  // Razorpay took the money but the browser never confirmed it (closed tab,
  // dropped connection): ask Razorpay directly and settle the entry here.
  if (e.payment_status !== "paid" && e.razorpay_order_id && isRazorpayEnabled) {
    const captured = capturedPayment(await fetchOrderPayments(e.razorpay_order_id).catch(() => []));
    if (captured) {
      const settled = await markOpenEntryPaid(e.reference, e.razorpay_order_id, captured.id);
      if (settled) {
        e = { ...e, ...settled };
        await afterEntryPaid(settled);
      }
    }
  }
  const paid = e.payment_status === "paid";
  const discount = Number(e.discount_paise ?? 0);

  return (
    <div className="wrap section max-w-3xl">
      <Link href="/dashboard/sparvic-open" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 hover:text-ink">
        <ArrowLeft size={15} /> {OPEN.name}
      </Link>

      <section className="so-confirm mt-5">
        <span className={`so-confirm-icon ${paid ? "" : "is-pending"}`}>{paid ? <CheckCircle2 size={30} /> : <Clock size={30} />}</span>
        <p className="so-kicker">{paid ? "Registration confirmed" : "Payment pending"}</p>
        <h1>{paid ? "You're in the Sparvic Open!" : "Your entry is saved"}</h1>
        <p className="mt-2 text-sm text-ink/70">
          {paid
            ? "Your payment went through and your place is confirmed. Fixtures and timings will be shared on Sparvic and WhatsApp."
            : "We haven't received the payment yet. If you were charged, it will confirm within a few minutes; otherwise pay from the tournament page."}
        </p>
        {discount > 0 && (
          <p className="so-congrats"><PartyPopper size={16} /> Congratulations! As an early-bird member you saved {formatPaise(discount)} ({OPEN.earlyBirdPct}% off).</p>
        )}
      </section>

      <section className="card mt-6 p-6">
        <p className="font-mono text-xs text-volt-deep">Entry {e.reference}</p>
        <ul className="mt-3 space-y-2">
          {e.categories.map((c) => (
            <li key={c.category} className="text-sm">
              <span className="font-semibold text-ink">{OPEN_CATEGORIES.find((x) => x.id === c.category)?.label ?? c.category}</span>
              {c.partner_name && <span className="text-ink/60"> · with {c.partner_name}</span>}
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-1 border-t border-ink/10 pt-4 text-sm">
          {discount > 0 && (
            <>
              <p className="flex justify-between"><span className="text-ink/60">Entry fees</span><span>{formatPaise(e.amount_paise + discount)}</span></p>
              <p className="flex justify-between text-volt-deep"><span>Early bird {OPEN.earlyBirdPct}% off</span><span>−{formatPaise(discount)}</span></p>
            </>
          )}
          <p className="flex justify-between text-base font-semibold"><span>{paid ? "Paid" : "To pay"}</span><span>{formatPaise(e.amount_paise)}</span></p>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink/65">
          <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {OPEN.dates}</span>
          <span className="inline-flex items-center gap-1"><MapPin size={13} /> {OPEN.venue}</span>
          <a href={`tel:+${OPEN.contactDigits}`} className="inline-flex items-center gap-1"><Phone size={13} /> {OPEN.contactDisplay}</a>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard/sparvic-open" className="btn-volt">{paid ? "Enter another category" : "Pay from the tournament page"}</Link>
        <Link href="/dashboard" className="btn-outline">Back to my clubhouse</Link>
      </div>
    </div>
  );
}

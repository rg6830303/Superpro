import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, MessageCircle, Phone } from "lucide-react";
import { CoachingPayButton } from "@/components/coaching-pay-button";
import { getRegistration } from "@/lib/coaching-registrations";
import { ensureSchema } from "@/lib/schema";
import { isRazorpayEnabled } from "@/lib/razorpay";
import { COACH, PROGRAM, SKILLS, venueById, formatRupees } from "@/lib/coaching-program";
import { waLink } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your registration", robots: { index: false } };

const STATUS_LABEL = {
  registered: "Registered — awaiting grouping",
  grouped: "Grouped — awaiting confirmation",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
} as const;

export default async function RegistrationStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams?: Promise<{ paid?: string }>;
}) {
  const { reference } = await params;
  if (!/^SP-[A-Z0-9]{8}$/.test(reference)) notFound();
  await ensureSchema();
  const reg = await getRegistration(reference);
  if (!reg) notFound();
  const justPaid = ((await searchParams) ?? {}).paid === "1";
  const paid = reg.payment_status === "paid";
  const venue = venueById(reg.pay_venue);
  const first = reg.name.trim().split(/\s+/)[0];

  // Personal details (phone, emergency contact, medical) are deliberately not shown here:
  // anyone with the link can open this page.
  const rows: [string, string][] = [
    ["Reference", reg.reference],
    ["Batch", reg.batch],
    ["Skill", SKILLS.find((s) => s.id === reg.skill)?.label ?? reg.skill],
    ["Preferred days", reg.days.join(", ")],
    ["Preferred timings", reg.timings.join(", ")],
    ["Venues", reg.venues.map((v) => venueById(v)?.name ?? v).join(", ")],
    ["Fee", `${formatRupees(reg.amount_paise / 100)} · ${venue?.name ?? reg.pay_venue}`],
    ["Status", STATUS_LABEL[reg.status]],
  ];

  return (
    <div className="wrap section max-w-2xl">
      <div className="card overflow-hidden">
        <div className={`px-6 py-7 text-center sm:px-8 ${paid ? "bg-volt-soft" : "bg-mist"}`}>
          <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${paid ? "bg-volt text-ink" : "bg-paper text-ink/60"}`}>
            {paid ? <CheckCircle2 size={28} /> : <Clock size={26} />}
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink sm:text-3xl">
            {paid ? (justPaid ? `Payment received, ${first}!` : "You're paid up") : `You're registered, ${first}!`}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink/70">
            {paid
              ? `Coach ${COACH.name} will group you with players at your level and confirm your days and timing on WhatsApp.`
              : `We'll group you with players at the same level (minimum ${PROGRAM.minGroupSize}). Your slot is confirmed once payment is done.`}
          </p>
        </div>

        <dl className="divide-y divide-line px-6 sm:px-8">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-3 py-3 text-sm">
              <dt className="text-ink/50">{k}</dt>
              <dd className="min-w-0 break-words font-medium text-ink">{v}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-3 text-sm">
            <dt className="text-ink/50">Payment</dt>
            <dd className={`font-semibold ${paid ? "text-volt-deep" : "text-signal"}`}>{paid ? "Paid" : "Pending"}</dd>
          </div>
        </dl>

        <div className="border-t border-line px-6 py-6 sm:px-8">
          {!paid && reg.status !== "cancelled" && isRazorpayEnabled && (
            <CoachingPayButton reference={reg.reference} venues={reg.venues} payVenue={reg.pay_venue} age={reg.age} />
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a href={`tel:+${PROGRAM.phoneDigits}`} className="btn-outline flex-1">
              <Phone size={15} /> Call
            </a>
            <a
              href={waLink(`Hi! I registered for ${PROGRAM.name} (ref ${reg.reference}).`, PROGRAM.phoneDigits)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline flex-1"
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          </div>
          <p className="mt-4 text-center text-xs text-ink/45">Save this page — it&apos;s your registration link.</p>
        </div>
      </div>
      <p className="mt-6 text-center">
        <Link href={`/coaching/${COACH.slug}`} className="text-sm font-semibold text-volt-deep hover:underline">
          About Coach {COACH.name}
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, MessageCircle, Phone } from "lucide-react";
import { DoctorPayButton } from "@/components/doctor-pay-button";
import { DOCTOR, getAppointment } from "@/lib/doctor";
import { isRazorpayEnabled } from "@/lib/razorpay";
import { waLink } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your consultation", robots: { index: false } };

const STATUS = { requested: "Requested", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" } as const;
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default async function AppointmentStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams?: Promise<{ paid?: string }>;
}) {
  const { reference } = await params;
  if (!/^DR-[A-Z0-9]{8}$/.test(reference)) notFound();
  const a = await getAppointment(reference);
  if (!a) notFound();
  const paid = a.payment_status === "paid";
  const justPaid = ((await searchParams) ?? {}).paid === "1";
  const first = a.name.trim().split(/\s+/)[0];

  // No phone, age or health details here: anyone with the link can open this page.
  const rows: [string, string][] = [
    ["Reference", a.reference],
    ["Consultation", `Clinic visit · ${DOCTOR.handle}`],
    ["Preferred", `${day(a.preferred_date)} · ${a.preferred_slot}`],
    ["Fee", `₹${(a.amount_paise / 100).toLocaleString("en-IN")}`],
    ["Status", STATUS[a.status]],
  ];

  return (
    <div className="wrap section max-w-2xl">
      <div className="card overflow-hidden">
        <div className={`px-6 py-7 text-center sm:px-8 ${paid ? "bg-volt-soft" : "bg-mist"}`}>
          <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${paid ? "bg-volt text-ink" : "bg-paper text-ink/60"}`}>
            {paid ? <CheckCircle2 size={28} /> : <Clock size={26} />}
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink sm:text-3xl">
            {paid ? (justPaid ? `You're booked, ${first}!` : "Consultation booked") : `Request saved, ${first}`}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink/70">
            {paid
              ? `${DOCTOR.handle} will confirm your exact time and the clinic location on WhatsApp.`
              : `Pay ₹${DOCTOR.fee} to confirm. ${DOCTOR.handle} will then confirm your time on WhatsApp.`}
          </p>
        </div>
        <dl className="divide-y divide-line px-6 sm:px-8">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 py-3 text-sm">
              <dt className="text-ink/50">{k}</dt>
              <dd className="min-w-0 break-words font-medium text-ink">{v}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-3 text-sm">
            <dt className="text-ink/50">Payment</dt>
            <dd className={`font-semibold ${paid ? "text-volt-deep" : "text-signal"}`}>{paid ? "Paid" : "Pending"}</dd>
          </div>
        </dl>
        <div className="border-t border-line px-6 py-6 sm:px-8">
          {!paid && a.status !== "cancelled" && isRazorpayEnabled && (
            <DoctorPayButton reference={a.reference} fee={DOCTOR.fee} doctorHandle={DOCTOR.handle} />
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a href={`tel:+${DOCTOR.phoneDigits}`} className="btn-outline flex-1"><Phone size={15} /> Call</a>
            <a href={waLink(`Hi ${DOCTOR.name}, about my consultation ${a.reference}.`, DOCTOR.phoneDigits)} target="_blank" rel="noopener noreferrer" className="btn-outline flex-1">
              <MessageCircle size={15} /> WhatsApp
            </a>
          </div>
          <p className="mt-4 text-center text-xs text-ink/45">Save this page — it&apos;s your booking link. Emergency? Call 112.</p>
        </div>
      </div>
      <p className="mt-6 text-center">
        <Link href="/medical" className="text-sm font-semibold text-volt-deep hover:underline">Back to Medical assistance</Link>
      </p>
    </div>
  );
}

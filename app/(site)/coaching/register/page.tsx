import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { CoachingRegisterForm } from "@/components/coaching-register-form";
import { getPlayerSession } from "@/lib/auth";
import { getUserRow } from "@/lib/accounts";
import { ageFrom } from "@/lib/profile";
import { isRazorpayEnabled } from "@/lib/razorpay";
import { COACH, PROGRAM, currentBatch } from "@/lib/coaching-program";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Register · Group coaching",
  description: `${PROGRAM.name} — register for the monthly beginner pickleball batch with ${COACH.name}. ${PROGRAM.classesPerMonth} classes a month.`,
};

export default async function CoachingRegisterPage() {
  const session = await getPlayerSession();
  const profile = session ? await getUserRow(session.id).catch(() => null) : null;
  const age = profile?.date_of_birth ? ageFrom(profile.date_of_birth) : null;
  const prefill = profile
    ? {
        name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        gender: profile.gender === "male" ? "Male" : profile.gender === "female" ? "Female" : "",
        age: age != null ? String(age) : "",
      }
    : null;

  return (
    <div className="wrap section max-w-3xl">
      <Link href={`/coaching/${COACH.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 hover:text-ink">
        <ArrowLeft size={15} /> Coach {COACH.name}
      </Link>
      <p className="eyebrow mt-6">{PROGRAM.name}</p>
      <h1 className="mt-2 headline-page">{currentBatch().split(" ")[0]} batch registration</h1>
      <p className="lede mt-4">
        Group coaching · {PROGRAM.classesPerMonth} sessions a month · minimum {PROGRAM.minGroupSize} players per group. Once
        grouping is done you&apos;ll get a confirmation — your slot is confirmed after payment.
      </p>
      <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink/60">
        <Phone size={14} /> Questions? Call or WhatsApp{" "}
        <a href={`tel:+${PROGRAM.phoneDigits}`} className="font-semibold text-volt-deep hover:underline">
          {PROGRAM.phoneDisplay}
        </a>
      </p>
      <div className="mt-8">
        <CoachingRegisterForm prefill={prefill} razorpayEnabled={isRazorpayEnabled} />
      </div>
    </div>
  );
}

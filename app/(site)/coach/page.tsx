import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, Clock, Users, CheckCircle2, ExternalLink } from "lucide-react";
import { CoachCalendar } from "@/components/coach-calendar";
import { CoachSignOut } from "@/components/coach-sign-out";
import { Avatar } from "@/components/player-directory";
import { liveCoachSession } from "@/lib/coach-auth";
import { ensureSchema } from "@/lib/schema";
import { coachSummary } from "@/lib/coach-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Coach dashboard", robots: { index: false } };

export default async function CoachDashboardPage() {
  const session = await liveCoachSession();
  if (!session) redirect("/coach/login");

  await ensureSchema();
  const summary = await coachSummary(session.coach_id).catch(() => null);
  // A session for a coach who has since been removed is no session at all.
  if (!summary) redirect("/coach/login");

  const tiles = [
    { icon: CalendarCheck, label: "This week", value: summary.this_week, hint: "Dated sessions in the next 7 days" },
    { icon: Clock, label: "Awaiting confirmation", value: summary.awaiting, hint: "Requests the club has not confirmed yet" },
    { icon: Users, label: "Clients", value: summary.clients, hint: "Different players who have booked you" },
    { icon: CheckCircle2, label: "Completed", value: summary.completed, hint: "Sessions marked done" },
  ];

  return (
    <div className="wrap section">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={summary.name} src={summary.image_url} />
          <div className="min-w-0">
            <p className="eyebrow">Coach portal</p>
            <h1 className="mt-1 headline-page">{summary.name}</h1>
            {summary.headline && <p className="mt-1 text-sm text-ink/60">{summary.headline}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/coaching#${summary.slug}`} className="btn-outline btn-sm">
            <ExternalLink size={14} /> Public profile
          </Link>
          <CoachSignOut />
        </div>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4 sm:p-5" title={t.hint}>
            <t.icon size={16} className="text-volt-deep" />
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">{t.label}</p>
            <p className="mt-1 font-display text-3xl text-ink">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <CoachCalendar />
      </div>

      <p className="mt-8 text-xs text-ink/45">
        Confirming, moving or cancelling a session is handled by the club desk — message them on WhatsApp and it will
        show up here.
      </p>
    </div>
  );
}

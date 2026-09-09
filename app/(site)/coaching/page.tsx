import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { CoachingFlow } from "@/components/coaching-flow";
import { EmptyState } from "@/components/ui";
import { getPlayerSession } from "@/lib/auth";
import { getCoaches } from "@/lib/queries";
import { isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { waLink } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coaching",
  description:
    "Pick your SuperPro coach — beginner clinics to DUPR-rated match play. Book 1-on-1, pair or small-group sessions in Kolkata.",
};

export default async function CoachingPage() {
  const [coaches, session] = await Promise.all([getCoaches(), getPlayerSession()]);

  return (
    <div className="wrap section">
      <p className="eyebrow">Coaching</p>
      <h1 className="mt-3 headline-page">Learn from someone better</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink/70">
        Every coach on this roster owns a rung of the ladder — first paddle, first rally, first competitive
        match, first DUPR rating. Pick the one who matches where you are, and SuperPro connects you directly.
      </p>

      <div className="mt-10">
        {coaches.length === 0 ? (
          <EmptyState
            title="Coach roster loading"
            sub="Our coaches are being onboarded. Message a rep and we'll match you to one today."
            action={
              <a
                href={waLink("Hi SuperPro! I'd like to book a coaching session.")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline btn-sm mt-2"
              >
                <MessageCircle size={14} /> Ask a rep
              </a>
            }
          />
        ) : (
          <CoachingFlow
            coaches={coaches}
            razorpayEnabled={isRazorpayEnabled}
            razorpayKeyId={razorpayKeyId}
            defaults={session ? { name: session.name, email: session.email } : undefined}
          />
        )}
      </div>
    </div>
  );
}

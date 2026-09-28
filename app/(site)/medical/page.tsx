import type { Metadata } from "next";
import { HeartPulse, MessageCircle, Phone, ShieldCheck, Stethoscope } from "lucide-react";
import { Reveal } from "@/components/motion";
import { MedicalSlideshow, type SlideshowImage } from "@/components/medical-slideshow";
import { SITE, waLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Medical Assistance",
  description:
    "On-court physio and first-response injury support at Sparvic sessions — Doctor Pickle, Avishek Kar.",
};

const DOCTOR = {
  handle: "Doctor Pickle",
  name: "Avishek Kar",
  phoneDisplay: "+91 91631 12544",
  phoneDigits: "919163112544",
};

const IMAGES: SlideshowImage[] = [
  { src: "/medical/medical-01.jpg", alt: "On-court assessment after a fall at Balltopia Arena" },
  { src: "/medical/medical-02.jpg", alt: "Leg stretch and recovery session courtside" },
  { src: "/medical/medical-05.jpg", alt: "Hamstring stretch during a break in play" },
  { src: "/medical/medical-03.jpg", alt: "Cool-down stretch after a long rally" },
  { src: "/medical/medical-04.jpg", alt: "Shoulder and back mobility work between games" },
  { src: "/medical/medical-06.jpg", alt: "Back on the court after treatment" },
];

const WHAT_TO_EXPECT = [
  {
    icon: Stethoscope,
    title: "On-court response",
    body: "First response for sprains, strains and knocks picked up mid-session — assessed where it happened, not after the fact.",
  },
  {
    icon: HeartPulse,
    title: "Stretch and recovery",
    body: "Guided stretching and mobility work so a niggle doesn't turn into next week's injury.",
  },
  {
    icon: ShieldCheck,
    title: "Call ahead",
    body: "For anything beyond a quick check — an existing injury, a concern before you play — message or call Avishek directly before your session.",
  },
];

export default function MedicalAssistancePage() {
  return (
    <>
      <section className="border-b border-line">
        <div className="wrap section">
          <p className="eyebrow">Medical Assistance</p>
          <h1 className="mt-6 max-w-3xl headline-page">Doctor Pickle is on the court.</h1>
          <p className="lede mt-8 max-w-2xl">
            Twisted an ankle mid-rally, pulled up short on a lunge, or just need a stretch talked through before
            you play — Avishek is the person to call. On site at Sparvic sessions for exactly this.
          </p>
        </div>
      </section>

      <section className="wrap section">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <Reveal>
            <MedicalSlideshow images={IMAGES} />
          </Reveal>

          <Reveal delay={80}>
            <div className="card p-6 sm:p-8">
              <p className="eyebrow">Contact</p>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45">{DOCTOR.handle}</p>
              <h2 className="mt-1 font-display text-3xl text-ink">{DOCTOR.name}</h2>
              <p className="mt-4 font-mono text-lg tabular-nums text-ink">{DOCTOR.phoneDisplay}</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`tel:+${DOCTOR.phoneDigits}`} className="btn-volt">
                  <Phone size={16} /> Call now
                </a>
                <a
                  href={waLink("Hi Avishek, I'd like some help with an injury / a stretch check before I play.", DOCTOR.phoneDigits)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>

              <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-ink/65">
                Available on site during {SITE.name} sessions for on-court injury support. For anything that
                isn't urgent, message ahead so he knows to expect you.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="wrap section border-t border-line">
        <h2 className="headline-section">What this covers</h2>
        <div className="mt-10 grid min-w-0 gap-x-12 gap-y-8 sm:grid-cols-3">
          {WHAT_TO_EXPECT.map((item, i) => (
            <Reveal key={item.title} delay={i * 60}>
              <div className="flex h-full gap-4 border-t border-line py-6 sm:border-t-0 sm:py-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-volt-soft text-volt-deep">
                  <item.icon size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-xl text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/65">{item.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

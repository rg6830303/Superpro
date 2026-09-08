import Link from "next/link";
import { Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { SITE, WHATSAPP_GROUP_URL, WHATSAPP_NUMBER, waLink } from "@/lib/site";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/products?category=paddles", label: "Paddles" },
      { href: "/products?category=balls", label: "Balls" },
      { href: "/products?category=grips", label: "Grips" },
      { href: "/cart", label: "Cart" },
    ],
  },
  {
    title: "Play",
    links: [
      { href: "/games", label: "Daily games" },
      { href: "/coaching", label: "Coaching" },
      { href: "/tournaments", label: "Tournaments" },
      { href: "/dashboard", label: "My bookings" },
    ],
  },
  {
    title: "Club",
    links: [
      { href: "/about", label: "About & vision" },
      { href: "/login", label: "Player login" },
      { href: "/signup", label: "Create account" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/10 bg-ink-900">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo height={40} href={null} />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-bone/50">
            {SITE.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={waLink("Hi SuperPro! I'd like to talk to a representative.")}
              target="_blank"
              rel="noopener noreferrer"
              className="chip hover:border-gold/50 hover:text-gold"
            >
              <MessageCircle size={13} /> WhatsApp a rep
            </a>
            <a href={SITE.instagram} target="_blank" rel="noopener noreferrer" className="chip hover:border-gold/50 hover:text-gold">
              <Instagram size={13} /> Instagram
            </a>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="eyebrow mb-4">{col.title}</p>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-bone/55 transition-colors hover:text-bone">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="wrap flex flex-col gap-4 border-t border-white/10 py-6 text-xs text-bone/40 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {SITE.legalName}. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={12} /> {SITE.city}
          </span>
          <a href={`mailto:${SITE.email}`} className="inline-flex items-center gap-1.5 hover:text-bone">
            <Mail size={12} /> {SITE.email}
          </a>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="hover:text-bone">
            +{WHATSAPP_NUMBER}
          </a>
          {WHATSAPP_GROUP_URL && (
            <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer" className="text-volt hover:text-volt-dark">
              Games group
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}

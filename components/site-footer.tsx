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

/**
 * The one deliberately dark block on the site. It closes the page the way a
 * back cover closes a book, and gives the volt accent somewhere to sit at full
 * strength without competing with the content above it.
 */
export function SiteFooter() {
  return (
    <footer className="mt-28 bg-ink text-paper">
      <div className="wrap grid min-w-0 gap-12 py-16 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Logo height={38} tone="white" href={null} />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-paper/60">{SITE.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href={waLink("Hi SuperPro! I'd like to talk to a representative.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-pill border border-paper/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/70 transition-colors hover:border-volt hover:text-volt"
            >
              <MessageCircle size={12} /> WhatsApp
            </a>
            <a
              href={SITE.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-pill border border-paper/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/70 transition-colors hover:border-volt hover:text-volt"
            >
              <Instagram size={12} /> Instagram
            </a>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-volt">{col.title}</p>
            <ul className="mt-5 space-y-3">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-paper/60 transition-colors hover:text-paper">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="wrap flex flex-col gap-4 border-t border-paper/15 py-7 font-mono text-[11px] text-paper/45 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {SITE.legalName}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={12} /> {SITE.city}
          </span>
          <a href={`mailto:${SITE.email}`} className="inline-flex items-center gap-1.5 hover:text-paper">
            <Mail size={12} /> {SITE.email}
          </a>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tabular-nums hover:text-paper"
          >
            +{WHATSAPP_NUMBER}
          </a>
          {WHATSAPP_GROUP_URL && (
            <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer" className="text-volt hover:underline">
              Games group
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}

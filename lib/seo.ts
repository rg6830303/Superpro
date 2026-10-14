import { SITE } from "@/lib/site";
import { OPEN, OPEN_CATEGORIES } from "@/lib/sparvic-open";

/**
 * Search, answer-engine and generative-engine content in one place: the
 * structured data Google and AI assistants read, and the plain-language FAQ
 * that is also shown on the home page (answers must match what's on screen).
 */

export const SEO_TITLE = "Sparvic — Kolkata's pickleball community: daily games, coaching, tournaments & gear";
export const SEO_DESCRIPTION =
  "Sparvic is Kolkata's pickleball community and sports platform: book daily open-play games at TurfXL New Alipore, Sportsplex Indoor Topsia and Ballygunge Arena, find players at your level, get coached, enter DUPR-rated tournaments like the Sparvic Open, and buy Champion Series paddles and balls.";

export const SEO_KEYWORDS = [
  "pickleball Kolkata",
  "Kolkata pickleball community",
  "where to play pickleball in Kolkata",
  "pickleball courts Kolkata",
  "pickleball near me Kolkata",
  "pickleball coaching Kolkata",
  "pickleball tournament Kolkata",
  "Sparvic Open",
  "DUPR tournament Kolkata",
  "pickleball paddles India",
  "sports community Kolkata",
  "Sparvic",
];

export const VENUES = [
  { name: "TurfXL", area: "New Alipore" },
  { name: "Sportsplex Indoor", area: "Topsia" },
  { name: "Ballygunge Arena", area: "Ballygunge" },
];

export const FAQ: Array<{ q: string; a: string }> = [
  { q: "What is Sparvic?", a: "Sparvic is a pickleball community and sports platform in Kolkata. Members book daily open-play games, find and follow players at their level, book coaching and clinic consultations, enter tournaments, and buy pickleball gear, all from one account." },
  { q: "Where can I play pickleball in Kolkata?", a: "Sparvic runs daily games at TurfXL in New Alipore, Sportsplex Indoor in Topsia and Ballygunge Arena in Ballygunge. The club posts the week's slots with venue and court number, and members book a slot from their Sparvic clubhouse." },
  { q: "How do I book a pickleball game with Sparvic?", a: "Create a free Sparvic account, open your clubhouse, choose Book a game, pick a slot that matches your level and pay from your wallet or online. Your name and court number are shared with the players in that slot." },
  { q: "Is Sparvic good for beginners?", a: "Yes. Slots are tagged by level (beginner, intermediate, advanced or all levels), so beginners play with people at a similar standard. Coaching is available if you want to learn the basics first." },
  { q: "Does Sparvic offer pickleball coaching in Kolkata?", a: "Yes. Sparvic offers group coaching batches and sessions with its coaches, including a monthly programme with coach Ishaan Chetani, booked and paid from the member clubhouse." },
  { q: "What is the Sparvic Open Tournament?", a: `The ${OPEN.name} is a three-day pickleball tournament on ${OPEN.dates} at ${OPEN.venue}, with nine DUPR-banded singles and doubles categories. Members register and pay online from their Sparvic clubhouse.` },
  { q: "Do I need a DUPR rating to play?", a: "Not for daily games: you pick a level when you join. Tournaments such as the Sparvic Open use DUPR bands, so you add your DUPR rating to your profile before you register." },
  { q: "Can I buy pickleball paddles and balls in Kolkata from Sparvic?", a: "Yes. The Sparvic pro shop sells Champion Series paddles, balls and accessories with free pickup at TurfXL New Alipore or delivery across Kolkata. You can check out as a guest." },
];

const url = (path = "") => `${SITE.url}${path}`;

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "@id": url("/#org"),
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    logo: url("/logo/sparvic-logo-on-white.png"),
    image: url("/og-sparvic.png"),
    description: SEO_DESCRIPTION,
    sport: "Pickleball",
    email: SITE.email,
    telephone: "+91-91631-32551",
    areaServed: { "@type": "City", name: "Kolkata" },
    address: { "@type": "PostalAddress", addressLocality: "Kolkata", addressRegion: "West Bengal", addressCountry: "IN" },
    sameAs: [SITE.instagram],
  };
}

export function websiteLd() {
  return { "@context": "https://schema.org", "@type": "WebSite", "@id": url("/#site"), name: SITE.name, url: SITE.url, inLanguage: "en-IN", publisher: { "@id": url("/#org") } };
}

export function venuesLd() {
  return VENUES.map((v) => ({
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: `Sparvic pickleball at ${v.name}, ${v.area}`,
    sport: "Pickleball",
    address: { "@type": "PostalAddress", addressLocality: `${v.area}, Kolkata`, addressRegion: "West Bengal", addressCountry: "IN" },
    parentOrganization: { "@id": url("/#org") },
    url: url("/games"),
  }));
}

export function faqLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function sparvicOpenLd() {
  const fees = OPEN_CATEGORIES.map((c) => c.feePaise / 100);
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: OPEN.name,
    description: `${OPEN.tagline} Nine DUPR-banded singles and doubles categories at ${OPEN.venue}.`,
    sport: "Pickleball",
    startDate: "2026-10-30",
    endDate: "2026-11-01",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: "TurfXL", address: { "@type": "PostalAddress", addressLocality: "New Alipore, Kolkata", addressRegion: "West Bengal", addressCountry: "IN" } },
    organizer: { "@id": url("/#org") },
    image: url("/og-sparvic.png"),
    url: url("/sparvic-open"),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: Math.min(...fees),
      highPrice: Math.max(...fees),
      offerCount: OPEN_CATEGORIES.length,
      availability: "https://schema.org/InStock",
      url: url("/sparvic-open"),
    },
  };
}

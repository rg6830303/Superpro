/**
 * RAG Knowledge Base for SuperPro Enterprise Pickleball Platform.
 * Contains structured domain knowledge on rules, venues, daily games,
 * equipment, coaching, tournaments, DUPR ratings, wallet, and platform navigation.
 */

export type KnowledgeChunk = {
  id: string;
  category: "rules" | "venues" | "games" | "shop" | "coaching" | "tournaments" | "dupr" | "wallet" | "community" | "support";
  title: string;
  keywords: string[];
  content: string;
  action?: {
    label: string;
    href: string;
  };
};

export const SUPERPRO_KNOWLEDGE: KnowledgeChunk[] = [
  {
    id: "rules-kitchen",
    category: "rules",
    title: "The Kitchen (Non-Volley Zone / NVZ) Rules",
    keywords: ["kitchen", "nvz", "non-volley zone", "rules", "line", "dink", "volley"],
    content: `The Kitchen is the 7-foot zone on both sides of the net. You cannot hit a volley (hitting the ball out of the air) while standing inside the Kitchen or touching any part of the Kitchen line. You may only enter the Kitchen if the ball has already bounced inside it. If you hit a volley, your momentum cannot cause you or any part of your gear (paddle, cap, shoes) to touch the Kitchen.`,
    action: { label: "Learn Mixer Rules", href: "/games#rules" },
  },
  {
    id: "rules-scoring",
    category: "rules",
    title: "Pickleball Scoring System (0-0-2)",
    keywords: ["scoring", "points", "how to score", "0-0-2", "serve", "rules", "win"],
    content: `In doubles pickleball, scores are called as three numbers: Server Score, Receiver Score, and Server Number (e.g., "4-2-1"). Only the serving team can score points. Games are typically played to 11 points, winning by 2. Each team has two servers before the serve passes to opponents ("Side Out"), except for the very first service of the game where only Server 2 serves ("0-0-2").`,
    action: { label: "Book a Game", href: "/games" },
  },
  {
    id: "rules-two-bounce",
    category: "rules",
    title: "The Two-Bounce (Double Bounce) Rule",
    keywords: ["two bounce", "double bounce", "serve bounce", "return", "rules"],
    content: `When the ball is served, the receiving team must let the ball bounce once before returning it. The serving team must also let the return bounce once before hitting it. After both the serve and the return have bounced once, either team can volley the ball out of the air or play it off a bounce.`,
    action: { label: "Explore Coaching", href: "/coaching" },
  },
  {
    id: "rules-serving",
    category: "rules",
    title: "Pickleball Serving Rules",
    keywords: ["serve", "serving", "underhand", "waist", "crosscourt", "fault"],
    content: `The serve must be hit underhand with the paddle contact made below waist level. The paddle head must be below the highest part of your wrist at contact. The ball must travel diagonally crosscourt and clear the 7-foot Kitchen line into the opponent's service court.`,
    action: { label: "Daily Games", href: "/games" },
  },
  {
    id: "venues-kolkata",
    category: "venues",
    title: "SuperPro Pickleball Venues & Courts in Kolkata",
    keywords: ["venues", "locations", "kolkata", "courts", "arena", "address", "timings", "salt lake"],
    content: `SuperPro operates premier dedicated pickleball facilities in Kolkata, including Central Kolkata and Salt Lake venues. Courts feature professional cushioned acrylic surfaces, anti-glare tournament LED lighting, player lounges, air-conditioned changing rooms, and hydration zones. Venues are open 7 days a week from 6:00 AM to 10:00 PM. SuperPro representatives are on-site for balls, paddles, and match coordination.`,
    action: { label: "View Venues & Slots", href: "/games" },
  },
  {
    id: "games-booking",
    category: "games",
    title: "Daily Games & Slot Booking Process",
    keywords: ["daily games", "book", "slot", "slots", "schedule", "court numbers", "cost", "how to play"],
    content: `Daily games are 60-minute open play sessions organized across Kolkata venues with 8 players per court rotating doubles. You can book slots for the week directly on the website. Specific court numbers are not assigned during booking — our venue rep assigns balanced courts upon your arrival. Once booked, your slot confirmation lands directly on WhatsApp.`,
    action: { label: "Book Daily Game Slots", href: "/games" },
  },
  {
    id: "games-cancellation",
    category: "games",
    title: "Game Booking Cancellation & Wallet Refunds",
    keywords: ["cancellation", "refund", "reschedule", "money back", "wallet refund"],
    content: `If you cancel or cannot make a booked slot, notify our venue team or cancel ahead of time. Fees paid via SuperPro Wallet are automatically refunded to your wallet balance instantly with zero deduction. Prepaid credits can be immediately used for any future slot, gear purchase, or tournament entry.`,
    action: { label: "Manage My Wallet", href: "/dashboard?tab=wallet" },
  },
  {
    id: "shop-paddles",
    category: "shop",
    title: "SuperPro Champion Series Carbon Fiber Paddles",
    keywords: ["paddles", "rackets", "carbon fiber", "toray", "equipment", "shop", "champion series", "price"],
    content: `SuperPro Champion Series paddles are crafted with Toray Japanese T700 carbon fiber faces and lightweight polypropylene honeycomb cores. Thermoformed edge walls provide high torsional stability and an enlarged sweet spot. Choose between Control paddles (soft touch, dinking, resets) and Power paddles (drives, punch volleys). Pickup available at Kolkata venues or delivery across India.`,
    action: { label: "Shop Paddles & Gear", href: "/products" },
  },
  {
    id: "shop-balls-grips",
    category: "shop",
    title: "Pickleball Balls & High-Humidity Grips",
    keywords: ["balls", "grips", "indoor", "outdoor", "humidity", "equipment", "accessories"],
    content: `We stock official 40-hole precision-drilled outdoor balls designed for Indian wind resistance and durability, as well as 26-hole indoor balls. SuperPro replacement grips feature tacky, sweat-wicking polyurethane engineered specifically for Kolkata's humid climate.`,
    action: { label: "Explore Accessories", href: "/products" },
  },
  {
    id: "coaching-sessions",
    category: "coaching",
    title: "Coaching, Clinics & Player Development",
    keywords: ["coaching", "coach", "lessons", "clinic", "training", "beginner", "intermediate", "drill"],
    content: `SuperPro certified coaches offer private 1-on-1 sessions, doubles strategy clinics, and skill-specific masterclasses (dinks, drops, resets, attacks). No fixed dates required during checkout: once you book a coach, they reach out directly via WhatsApp to confirm convenient dates and times at your preferred Kolkata venue.`,
    action: { label: "Find a Coach", href: "/coaching" },
  },
  {
    id: "tournaments-info",
    category: "tournaments",
    title: "Pickleball Tournaments, Draws & Prize Pools",
    keywords: ["tournaments", "competition", "draw", "brackets", "cash prize", "teams", "register"],
    content: `SuperPro hosts regular competitive tournaments with cash prize pools, official trophies, and DUPR match recording. Formats include Round-Robin pool matches followed by single-elimination finals. Divisions are separated by DUPR rating (Beginner, Intermediate, Advanced, Open) to ensure competitive parity.`,
    action: { label: "View Tournaments", href: "/tournaments" },
  },
  {
    id: "dupr-ratings",
    category: "dupr",
    title: "DUPR Rating System Explained",
    keywords: ["dupr", "rating", "skill level", "beginner", "intermediate", "advanced", "pro", "level"],
    content: `DUPR (Dynamic Universal Pickleball Rating) is the global gold standard rating system ranging from 2.0 to 8.0. Skill bands at SuperPro: Beginner (< 3.0), Intermediate (3.0 – 3.75), Advanced (3.75 – 4.5), Pro (4.5+). Enter your DUPR ID and rating in your SuperPro account profile to ensure fair matching in daily games and tournament divisions.`,
    action: { label: "Update My DUPR Rating", href: "/dashboard?tab=profile" },
  },
  {
    id: "wallet-payments",
    category: "wallet",
    title: "SuperPro Wallet & Payment Options",
    keywords: ["wallet", "razorpay", "upi", "card", "pay online", "venue payment", "cash"],
    content: `SuperPro Wallet offers instant one-tap checkout with zero gateway delays. Top up your balance anytime using Razorpay (UPI, Google Pay, PhonePe, credit/debit cards) or load cash with any SuperPro rep at the venue. Your balance, transactions, and auto-refunds are visible in real time under the Wallet tab in your account.`,
    action: { label: "Open SuperPro Wallet", href: "/dashboard?tab=wallet" },
  },
  {
    id: "community-discover",
    category: "community",
    title: "Player Community, Discover & Following",
    keywords: ["community", "discover", "follow", "friends", "activity", "feed", "notifications", "social"],
    content: `Search and discover other picklers across Kolkata right from your account dashboard! Follow players to get live alerts in your Activity Feed whenever they book a daily game slot or enter a tournament. You can also view public player profiles to inspect ratings and match history.`,
    action: { label: "Find players", href: "/dashboard?tab=discover" },
  },
  {
    id: "support-contact",
    category: "support",
    title: "SuperPro Contact & WhatsApp Support",
    keywords: ["contact", "support", "whatsapp", "phone", "help", "number", "reach"],
    content: `Need immediate help with a court booking, paddle query, or tournament registration? Message or call our official SuperPro WhatsApp helpline at +91 91631 32551. Our team and court managers are available 7 days a week from 6:00 AM to 10:00 PM.`,
    action: { label: "Chat on WhatsApp", href: "https://wa.me/919163132551" },
  },
];

/**
 * Intelligent context retrieval function.
 * Scores knowledge chunks based on query keywords, title matching, and intent classification.
 */
export function retrieveRelevantContext(queryText: string, topK = 3): KnowledgeChunk[] {
  const normalized = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 1);

  if (tokens.length === 0) {
    return SUPERPRO_KNOWLEDGE.slice(0, topK);
  }

  const scored = SUPERPRO_KNOWLEDGE.map((chunk) => {
    let score = 0;

    // Direct title matches get highest weight
    const titleLower = chunk.title.toLowerCase();
    for (const t of tokens) {
      if (titleLower.includes(t)) score += 8;
    }

    // Keyword matches
    for (const kw of chunk.keywords) {
      if (normalized.includes(kw.toLowerCase())) score += 12;
      for (const t of tokens) {
        if (kw.toLowerCase().includes(t)) score += 5;
      }
    }

    // Content substring matches
    const contentLower = chunk.content.toLowerCase();
    for (const t of tokens) {
      if (contentLower.includes(t)) score += 2;
    }

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const results = scored.filter((s) => s.score > 0).slice(0, topK).map((s) => s.chunk);

  // Fallback to general knowledge if nothing scored
  return results.length > 0 ? results : SUPERPRO_KNOWLEDGE.slice(0, topK);
}

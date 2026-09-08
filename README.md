# SuperPro

Kolkata's pickleball house — Champion Series gear, daily open games, coaching and
tournaments. One Next.js app that deploys twice: a customer site and a
host-separated admin console.

## Stack

- **Next.js 15** (App Router, TypeScript) + **Tailwind CSS**
- **Supabase** — Postgres for app data, Supabase Auth for player and admin sign-in
- **Razorpay** (optional) — checkout falls back to pay-at-venue / cash without it
- **WhatsApp** — booking receipts and daily-games group posts
- Deployed on **Vercel**

## What's in it

| Surface | Routes |
| --- | --- |
| Home, about & vision | `/`, `/about` |
| Shop — paddles, balls, grips | `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/order/[orderNo]` |
| Daily games — register → pick the week's slots → checkout | `/games` |
| Coaching — pick a coach → session → checkout | `/coaching` |
| Tournaments — announcements, entry, published draw | `/tournaments`, `/tournaments/[slug]` |
| Player account — profile, wallet, bookings | `/login`, `/signup`, `/dashboard`, `/dashboard/profile` |
| Admin console | `/admin` — games, orders, products, coaching, tournaments, players & wallets, WhatsApp outbox, settings |

Every page carries a WhatsApp "talk to a rep" path with the message pre-filled.

## Local development

```bash
npm install
cp .env.example .env.local     # fill in Supabase + session secret
npm run dev                    # http://localhost:3000
```

With `NEXT_PUBLIC_ADMIN_HOST` unset, `/admin` is reachable on localhost in dev so
both surfaces share one origin. In production the middleware hides each from the
other by host.

Create the schema and seed starter content once:

```bash
curl -X POST "http://localhost:3000/api/db-init?token=$SEED_TOKEN"
```

## Conventions worth knowing

- **Money is always integer paise.** Never floats. `lib/money.ts` formats for display.
- **Prices are re-read server-side** at checkout — the browser cart is display state only.
- **Dates**: scheduling is IST (`lib/dates.ts`). Postgres `DATE` columns come back
  as JS `Date`, so every formatter accepts both shapes.
- **Reads are bounded** (`withTimeout`) and fall back to placeholder content, so a
  slow database degrades the page instead of hanging it.
- `lib/schema.ts` is the single source of truth for the schema; `ensureSchema()`
  auto-heals a fresh database on the write paths.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the two-project Vercel setup, environment
variables, auth model and WhatsApp delivery tiers.

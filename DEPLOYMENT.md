# SuperPro — deployment

Two Vercel projects deploy from **the same repo and the same `main` branch**. They
differ only by environment variables: one serves the customer site, the other
serves the admin console. `middleware.ts` reads the host and decides which
surface is allowed, so the console is a 404 on the customer domain and the shop
is unreachable on the admin domain.

| Project | Domain | `NEXT_PUBLIC_ADMIN_HOST` | Serves |
| --- | --- | --- | --- |
| `superpro` | `superpro.vercel.app` | *(leave unset)* | Public site, `/admin` returns 404 |
| `superproadmin` | `superproadmin.vercel.app` | `superproadmin.vercel.app` | Admin console, `/` redirects to `/admin` |

Both projects: framework **Next.js**, build `npm run build`, production branch
`main`, region **`iad1`** (`vercel.json`) — the Supabase project lives in
`us-east-1`, and putting the functions next to the database removes a ~250 ms
round trip from every query.

## 1. Environment variables

Set these in **both** projects (Settings → Environment Variables → Production).
`.env.example` is the authoritative list; the essentials are:

| Variable | Notes |
| --- | --- |
| `POSTGRES_URL` | Supabase **Transaction pooler** string, port **6543**. The direct `:5432` URL exhausts connections on serverless. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key — safe in the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Creates accounts, bypasses RLS. Server only. |
| `SESSION_SECRET` | 32+ random chars — `openssl rand -hex 32`. Signs the session cookie. **Recommended, not required**: if it is unset the key is derived from `SUPABASE_SERVICE_ROLE_KEY`, so logins keep working. Setting it explicitly lets you rotate every session without touching Supabase. |
| `ADMIN_USERNAME` | `ishaanchetani` |
| `ADMIN_PASSWORD` | Bootstrap password for the first admin sign-in. |
| `ADMIN_EMAIL_DOMAIN` | `superpro.in` — the username is expanded to `<username>@<domain>` for Supabase. |
| `NEXT_PUBLIC_ADMIN_HOST` | **Admin project only.** |
| `NEXT_PUBLIC_SITE_URL` | Public site URL, used for canonical/OG tags. |
| `SEED_TOKEN` | Protects `POST /api/db-init`. |
| `CRON_SECRET` | Vercel sends it as a bearer token to `/api/cron/*`. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Rep number behind every "chat with a rep" button. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Optional. Without them checkout falls back to pay-at-venue / cash. |

## 2. Create the schema (once)

After the first deploy:

```bash
curl -X POST "https://superpro.vercel.app/api/db-init?token=$SEED_TOKEN"
```

Idempotent — every table is `CREATE TABLE IF NOT EXISTS` and every seed row is
`ON CONFLICT DO NOTHING`, so re-running it never overwrites live data. It
creates the tables, then seeds products, venues, coaches, tournaments and a
week of open game slots.

Check the connection any time:

```bash
curl https://superpro.vercel.app/api/health/db
# {"ok":true,"db":{"endpoint":"transaction-pooler","pooled":true,...}}
```

If `pooled` is `false`, `POSTGRES_URL` is pointing at the direct connection —
fix it before taking traffic.

## 3. Authentication

**Supabase Auth is the identity provider for both surfaces.** Passwords live in
Supabase `auth.users`; this app stores no password hashes. After Supabase
verifies a sign-in, the app mints a short signed cookie so the Edge middleware
can gate routes without a database round trip — and because the two surfaces sit
on different domains, their sessions are completely separate.

- **Players** sign up at `/signup` with a DUPR ID and rating. Their category is
  derived from the rating — below 3.5 beginner, 3.5–4.0 intermediate, 4.0+
  advanced — on the client for live feedback and again on the server, which
  never accepts a category from the browser. The account is created in Supabase
  and mirrored into `public.users` (same id) with their profile and wallet.
- **Admins** sign in at `/admin/login` with a **username**, which is expanded to
  `<username>@ADMIN_EMAIL_DOMAIN`. Two gates must pass: Supabase accepts the
  password, *and* the account carries an admin role. On the first sign-in with
  `ADMIN_USERNAME` + `ADMIN_PASSWORD`, the owner account is created in Supabase
  automatically, so a fresh project is never locked out.

Change the admin password afterwards in the Supabase dashboard
(Authentication → Users), or by updating `ADMIN_PASSWORD` and signing in again —
the bootstrap path re-syncs the password to the configured value.

## 4. Running the club from the console

Everything the club changes day to day is editable at `/admin`, no redeploy:

| Page | What you can do |
| --- | --- |
| Players | Create accounts (provisions the Supabase sign-in), edit any field, reset passwords, grant console access, delete accounts, and credit/debit wallets |
| Daily games | Bulk-build slots (dates × times × courts), edit or cancel a slot, add and edit venues, assign courts per player, and post the line-up to the WhatsApp group |
| Coaching | Coach roster CRUD — rates, specialties, available days — plus confirming session requests |
| Products | Full catalogue CRUD including stock, pricing, images and featured flags |
| Tournaments | Create and edit events, review entries, auto-group teams by combined DUPR, and publish the draw |
| Orders | Payment and fulfilment state |
| WhatsApp | Outbox, group broadcast, and one-tap send for anything queued |

## 5. Wallet

Players hold prepaid credit in paise on `users.wallet_balance_paise`, with an
immutable ledger in `wallet_transactions`. Admins top up or correct a balance
from **Admin → Players → Wallet**; every movement records which admin made it.

Wallet credit is a payment method at game-slot and shop checkout for signed-in
players. The debit is a single conditional `UPDATE` that refuses to go below
zero, so two concurrent bookings can never spend the same rupee, and a booking
that fails after the debit is auto-refunded.

## 6. WhatsApp

Meta's Cloud API cannot post into a group chat, so confirmed slots reach the
group in three tiers, best available first:

1. `WHATSAPP_WEBHOOK_URL` — a relay you control (n8n, Make, a `whatsapp-web.js`
   bridge). The only way to post to a group automatically.
2. `WHATSAPP_CLOUD_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` — direct-to-player
   confirmations via the official API.
3. Manual — the message is queued in `whatsapp_outbox` and **Admin → WhatsApp**
   offers a one-tap "post to group" link with the text pre-filled.

Nothing is ever lost: every attempt is recorded either way.

## 7. Cron

`vercel.json` registers `/api/cron/daily-digest` at 01:30 UTC (07:00 IST). It
rolls the schedule forward so there is always a week of open slots, then posts
the day's line-up to the group. Enable it on the **public** project only.

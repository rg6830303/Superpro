import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, GraduationCap, Package, Trophy } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { EmptyState } from "@/components/ui";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { formatDate, formatTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

type GameRow = {
  id: string;
  session_date: string;
  start_time: string;
  venue_name: string;
  court_number: number | null;
  status: string;
  payment_status: string;
  amount_paise: number;
};

type CoachRow = {
  booking_no: string;
  coach_name: string;
  preferred_date: string | null;
  preferred_time: string | null;
  sessions_count: number;
  status: string;
  amount_paise: number;
};

type OrderRow = {
  order_no: string;
  total_paise: number;
  fulfillment_status: string;
  payment_status: string;
  created_at: string;
};

export default async function DashboardPage() {
  const session = await getPlayerSession();
  if (!session) redirect("/login?next=/dashboard");

  await ensureSchema();

  const [games, coaching, orders] = await Promise.all([
    query<GameRow>(
      `SELECT r.id, s.session_date, s.start_time, v.name AS venue_name,
              COALESCE(r.court_number, s.court_number) AS court_number,
              r.status, r.payment_status, r.amount_paise
       FROM game_registrations r
       JOIN game_sessions s ON s.id = r.session_id
       JOIN venues v ON v.id = s.venue_id
       WHERE r.user_id = $1
       ORDER BY s.session_date DESC, s.start_time DESC LIMIT 20`,
      [session.id],
    ).catch(() => []),
    query<CoachRow>(
      `SELECT b.booking_no, c.name AS coach_name, b.preferred_date, b.preferred_time,
              b.sessions_count, b.status, b.amount_paise
       FROM coaching_bookings b JOIN coaches c ON c.id = b.coach_id
       WHERE b.user_id = $1 ORDER BY b.created_at DESC LIMIT 10`,
      [session.id],
    ).catch(() => []),
    query<OrderRow>(
      `SELECT order_no, total_paise, fulfillment_status, payment_status, created_at
       FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [session.id],
    ).catch(() => []),
  ]);

  const upcoming = games.filter((g) => g.status === "confirmed").length;

  return (
    <div className="wrap py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My account</p>
          <h1 className="mt-2 text-[clamp(2.25rem,6vw,3.5rem)]">{session.name}</h1>
          <p className="mt-1 text-sm text-bone/45">{session.email}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-9 grid gap-4 sm:grid-cols-3">
        {[
          { icon: CalendarDays, k: `${upcoming}`, v: "Game bookings" },
          { icon: GraduationCap, k: `${coaching.length}`, v: "Coaching bookings" },
          { icon: Package, k: `${orders.length}`, v: "Orders" },
        ].map((s) => (
          <div key={s.v} className="card p-5">
            <s.icon size={17} className="text-gold" />
            <p className="mt-3 font-display text-4xl text-bone">{s.k}</p>
            <p className="text-xs uppercase tracking-wider text-bone/40">{s.v}</p>
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="mb-5 text-3xl">Game bookings</h2>
        {games.length === 0 ? (
          <EmptyState
            title="No games booked yet"
            sub="Pick a slot for this week and your court number lands on WhatsApp."
            action={
              <Link href="/games" className="btn-gold btn-sm mt-2">
                Book a slot
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Venue</th>
                  <th>Court</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td>{formatDate(g.session_date)}</td>
                    <td>{formatTime(g.start_time)}</td>
                    <td>{g.venue_name}</td>
                    <td>{g.court_number ?? "—"}</td>
                    <td>{formatPaise(g.amount_paise)}</td>
                    <td>
                      <span className={g.status === "cancelled" ? "chip" : g.payment_status === "paid" ? "chip-live" : "chip-gold"}>
                        {g.status === "cancelled" ? "Cancelled" : g.payment_status === "paid" ? "Paid" : "Pay at venue"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {coaching.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-3xl">Coaching</h2>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Coach</th>
                  <th>First session</th>
                  <th>Sessions</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {coaching.map((c) => (
                  <tr key={c.booking_no}>
                    <td className="font-mono text-xs text-gold">{c.booking_no}</td>
                    <td>{c.coach_name}</td>
                    <td>{c.preferred_date ? `${formatDate(c.preferred_date)} · ${c.preferred_time}` : "—"}</td>
                    <td>{c.sessions_count}</td>
                    <td>{formatPaise(c.amount_paise)}</td>
                    <td>
                      <span className="chip capitalize">{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {orders.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-3xl">Orders</h2>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_no}>
                    <td>
                      <Link href={`/order/${o.order_no}`} className="font-mono text-xs text-gold hover:underline">
                        {o.order_no}
                      </Link>
                    </td>
                    <td>{new Date(o.created_at).toLocaleDateString("en-IN")}</td>
                    <td>{formatPaise(o.total_paise)}</td>
                    <td className="capitalize">{o.payment_status}</td>
                    <td>
                      <span className="chip capitalize">{o.fulfillment_status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mt-14 card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <Trophy size={22} className="text-gold" />
        <h2 className="text-2xl">Ready for a draw?</h2>
        <p className="max-w-md text-sm text-bone/50">
          Tournament entries are open to every registered player. Grab a partner and enter.
        </p>
        <Link href="/tournaments" className="btn-outline btn-sm">
          See tournaments
        </Link>
      </div>
    </div>
  );
}

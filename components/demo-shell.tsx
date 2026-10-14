"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Bell, CalendarCheck, CalendarDays, Compass, LayoutDashboard, Medal, GraduationCap, HeartPulse, Home, Menu, ShoppingBag, Trophy, UserRound, Users, Wallet, X } from "lucide-react";
import { BrowserNotifier } from "@/components/browser-notifier";
import { LiveLeaderboard } from "@/components/live-leaderboard";
import { LogoutButton } from "@/components/logout-button";
import { Logo } from "@/components/logo";
import { useCart } from "@/components/cart-provider";
import { SiteFooter } from "@/components/site-footer";
import { FloatingActions } from "@/components/floating-actions";
import { WelcomePopup } from "@/components/welcome-popup";
import { lockScroll } from "@/lib/scroll-lock";
import { ReadProgress } from "@/components/motion";
import { SITE } from "@/lib/site";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/games", label: "Daily games", icon: CalendarDays },
  { href: "/players", label: "Find your people", icon: Users },
  { href: "/products", label: "The pro shop", icon: ShoppingBag },
  { href: "/coaching", label: "Get coached", icon: GraduationCap },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/medical", label: "Player care", icon: HeartPulse },
];

// Signed-in players get their own clubhouse first, the rest of the club second.
const memberLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/play", label: "Book a game", icon: CalendarDays },
  { href: "/dashboard/bookings", label: "My bookings", icon: CalendarCheck },
  { href: "/dashboard/community", label: "Community", icon: Compass },
  { href: "/dashboard/rankings", label: "Leaderboard", icon: Medal },
  { href: "/dashboard/activity", label: "Activity", icon: Bell },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/profile", label: "My profile", icon: UserRound },
  { href: "/dashboard/coaching", label: "Coaching", icon: GraduationCap },
  { href: "/dashboard/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/dashboard/medical", label: "Player care", icon: HeartPulse },
];

const sectionNotes: Record<string, { label: string; note: string }> = {
  games: { label: "PLAY / DAILY GAMES", note: "A little competition. A lot of good company." },
  players: { label: "CONNECT / THE COMMUNITY", note: "Your next doubles partner could be right here." },
  products: { label: "GEAR / THE PRO SHOP", note: "Good gear. Great feel. Game on." },
  coaching: { label: "GROW / COACHING", note: "Small improvements. Big court energy." },
  tournaments: { label: "COMPETE / TOURNAMENTS", note: "Bring your partner. Bring your game." },
  medical: { label: "RECOVER / PLAYER CARE", note: "Look after yourself. Keep doing what you love." },
  about: { label: "BELONG / OUR STORY", note: "Built around a game. Brought to life by people." },
  cart: { label: "GEAR / YOUR BAG", note: "A few good additions to your game." },
  checkout: { label: "GEAR / CHECKOUT", note: "Your next on-court favourites, almost yours." },
};

// The phone tab bar inside the clubhouse: the one place to switch sections.
const clubhouseTabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/play", label: "Play", icon: CalendarDays },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/dashboard/community", label: "Community", icon: Users },
  { href: "/dashboard/profile", label: "You", icon: UserRound },
];

/**
 * Two interfaces in one shell:
 * - the clubhouse (signed in, under /dashboard): member sidebar, member tab bar,
 *   nothing from the public site;
 * - the website (everything else, signed in or not): public header nav and
 *   public menu, with an account button that leads back to the clubhouse.
 */
export function DemoShell({ children, playerName }: { children: React.ReactNode; playerName: string | null }) {
  const pathname = usePathname();
  const signedIn = playerName !== null;
  const clubhouse = signedIn && (pathname === "/dashboard" || pathname.startsWith("/dashboard/"));
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const { count, ready } = useCart();
  const section = pathname.split("/")[1];
  const sectionNote = clubhouse ? undefined : sectionNotes[section];
  useEffect(() => setOpen(false), [pathname]);
  // App-style navigation: a thin progress bar while the next page loads, and a
  // direction hint (forward / back) so pages slide in from the right side.
  const [navigating, setNavigating] = useState(false);
  useEffect(() => { setNavigating(false); }, [pathname]);
  useEffect(() => {
    const root = document.documentElement;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      root.dataset.nav = "forward";
      setNavigating(true);
    };
    const onPop = () => { root.dataset.nav = "back"; };
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    return () => { document.removeEventListener("click", onClick); window.removeEventListener("popstate", onPop); };
  }, []);
  // Crossing between the two interfaces gets its own short transition:
  // into the clubhouse (after signing in, or from the website) and back out.
  const [transition, setTransition] = useState<"enter" | "leave" | null>(null);
  useEffect(() => {
    const mode = clubhouse ? "clubhouse" : "website";
    let prev: string | null = null;
    try { prev = sessionStorage.getItem("sparvic:iface"); sessionStorage.setItem("sparvic:iface", mode); } catch {}
    if (!prev || prev === mode) return;
    setTransition(mode === "clubhouse" ? "enter" : "leave");
    const t = setTimeout(() => setTransition(null), mode === "clubhouse" ? 2100 : 1900);
    return () => clearTimeout(t);
  }, [clubhouse]);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    const unlock = lockScroll();
    return () => { unlock(); dialog.current?.close(); toggle.current?.focus(); };
  }, [open]);
  const active = (href: string) => href === "/" || href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const item = ({ href, label, icon: Icon }: (typeof links)[number]) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active(href) ? "page" : undefined}><Icon size={19} /><span>{label}</span>{href === "/dashboard/activity" && unread > 0 ? <b className="demo-badge-inline">{unread > 9 ? "9+" : unread}</b> : active(href) && <span className="demo-nav-dot" />}</Link>;
  const nav = (mobile = false) => clubhouse
    ? <nav aria-label={mobile ? "Clubhouse menu" : "Your clubhouse"}><p className="demo-nav-label">YOUR CLUBHOUSE</p>{memberLinks.map(item)}<div className="demo-nav-divider" /><Link href="/" onClick={() => setOpen(false)}><ArrowLeft size={19} /><span>Visit the website</span></Link><LogoutButton className="demo-nav-signout" /></nav>
    : <nav aria-label={mobile ? "All sections" : "Main navigation"}>{links.map(item)}<div className="demo-nav-divider" /><Link href="/about" onClick={() => setOpen(false)}><ArrowUpRight size={19} />The Sparvic story</Link></nav>;
  return <div data-demo-page={section || "home"} className={`demo-ui ${clubhouse ? "demo-member demo-clubhouse" : "demo-guest"}`}>
    <ReadProgress />
    {navigating && <div className="demo-nav-progress" aria-hidden="true" />}
    {sectionNote && <div key={pathname} className={`demo-section-toast demo-ribbon-${section}`} role="status"><span>{sectionNote.label}</span><p>{sectionNote.note}</p></div>}
    {signedIn && <BrowserNotifier onUnread={setUnread} />}
    {transition === "enter" && <div className="demo-enter" aria-live="polite"><div className="demo-enter-card"><Logo height={46} href={null} /><p className="demo-nav-label">WELCOME TO YOUR CLUBHOUSE</p><h2>Hey {playerName?.split(" ")[0]}, let’s play.</h2><span className="demo-enter-bar" /></div></div>}
    {transition === "leave" && <div className="demo-leave" aria-live="polite"><span className="demo-leave-wipe" /><div className="demo-leave-card"><Logo height={40} href={null} /><p className="demo-nav-label">LEAVING THE CLUBHOUSE</p><h2>Off to the club website.</h2><span className="demo-leave-court" aria-hidden="true" /></div></div>}
    {/* Living background: drifting colour fields, a slowly panning court grid and a
        few floating balls. Fixed behind every page; static under reduced motion. */}
    <div className="demo-backdrop" aria-hidden="true">
      <span className="demo-blob demo-blob-a" />
      <span className="demo-blob demo-blob-b" />
      <span className="demo-blob demo-blob-c" />
      <span className="demo-blob demo-blob-d" />
      <span className="demo-court-grid" />
      <span className="demo-ball demo-ball-1" />
      <span className="demo-ball demo-ball-2" />
      <span className="demo-ball demo-ball-3" />
      <span className="demo-ball demo-ball-4" />
      <span className="demo-ball demo-ball-5" />
      <span className="demo-ball demo-ball-6" />
      <span className="demo-ball demo-ball-7" />
      <span className="demo-ball demo-ball-8" />
      <span className="demo-paddle demo-paddle-1" />
      <span className="demo-paddle demo-paddle-2" />
      <span className="demo-paddle demo-paddle-3" />
      <span className="demo-paddle demo-paddle-4" />
      <span className="demo-paddle demo-paddle-5" />
    </div>
    <a className="demo-skip" href="#main-content">Skip to content</a>
    <header className="demo-header">
      <div className="demo-brand"><Logo height={42} priority href={clubhouse ? "/dashboard" : "/"} /><span className="demo-brand-caption">{clubhouse ? "THE CLUBHOUSE" : "THE PICKLEBALL CLUB"}</span></div>
      {!clubhouse && <nav className="demo-public-nav" aria-label="Main navigation">{links.slice(1, 6).map(l => <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined}>{l.label}</Link>)}</nav>}
      {clubhouse && <div className="demo-header-context"><span className="demo-live-dot" />Hi {playerName.split(" ")[0]}, welcome back.</div>}
      <div className="demo-header-actions">
        {clubhouse
          ? <Link href="/dashboard/activity" className="demo-icon-button" aria-label={`Activity${unread ? `, ${unread} unread` : ""}`}><Bell size={20} />{unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}</Link>
          : <Link href="/cart" className="demo-icon-button" aria-label={`Shopping bag${ready && count ? `, ${count} items` : ""}`}><ShoppingBag size={20} />{ready && count > 0 && <b>{count}</b>}</Link>}
        {clubhouse
          ? <Link href="/dashboard/play" className="demo-account demo-account-cta"><CalendarDays size={17} /><span>Book a game</span></Link>
          : <Link href={signedIn ? "/dashboard" : "/login"} className="demo-account" aria-label={signedIn ? "Open your clubhouse" : "Sign in"}><UserRound size={17} /><span>{signedIn ? "Clubhouse" : "Sign in"}</span></Link>}
        <button ref={toggle} className="demo-menu-button" onClick={() => setOpen(true)} aria-label={clubhouse ? "Open clubhouse menu" : "Open all sections"} aria-expanded={open}><Menu size={21} /></button>
      </div>
    </header>
    {clubhouse && <aside className="demo-sidebar">{nav()}<div className="demo-sidebar-board"><div className="demo-sidebar-board-head"><p className="demo-nav-label">LEADERBOARD</p><Link href="/dashboard/rankings">All</Link></div><LiveLeaderboard meId={null} limit={5} variant="mini" /></div></aside>}
    <div className="demo-body"><main id="main-content" tabIndex={-1}>{children}</main>{clubhouse ? <footer className="demo-member-footer"><Logo height={25} href={null} /><span>© {new Date().getFullYear()} {SITE.legalName}</span><Link href="/">Website</Link><Link href="/about">Our story</Link><a href={`mailto:${SITE.email}`}>Contact the club</a></footer> : <SiteFooter surface="demo" />}</div>
    <dialog ref={dialog} aria-label={clubhouse ? "Clubhouse menu" : "All sections"} className="demo-drawer" onCancel={() => setOpen(false)} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}><div className="demo-drawer-head"><Logo height={38} href={null} /><button className="demo-icon-button" onClick={() => setOpen(false)} aria-label="Close menu"><X size={22} /></button></div>{nav(true)}<Link className="btn-volt mt-6 w-full" href={clubhouse ? "/dashboard/play" : signedIn ? "/dashboard" : "/signup"} onClick={() => setOpen(false)}>{clubhouse ? "Book a game" : signedIn ? "My clubhouse" : "Join the club"}<ArrowUpRight size={17} /></Link><div className="demo-drawer-support"><p>Need a hand? Ask the caddy or talk to the club.</p><FloatingActions /></div></dialog>
    {clubhouse && <nav className="demo-bottom-nav" aria-label="Clubhouse sections">{clubhouseTabs.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}><Icon size={20} /><span>{label}</span></Link>)}</nav>}
    <div className="demo-support"><FloatingActions /></div>
    <Suspense fallback={null}><WelcomePopup demo /></Suspense>
  </div>;
}

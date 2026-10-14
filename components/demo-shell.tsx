"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, GraduationCap, HeartPulse, Home, MapPin, Menu, ShoppingBag, Trophy, UserRound, Users, Wallet, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { useCart } from "@/components/cart-provider";
import { SiteFooter } from "@/components/site-footer";
import { FloatingActions } from "@/components/floating-actions";
import { WelcomePopup } from "@/components/welcome-popup";
import { lockScroll } from "@/lib/scroll-lock";
import { ReadProgress } from "@/components/motion";
import { SITE } from "@/lib/site";

const links = [
  { href: "/", label: "Clubhouse", icon: Home },
  { href: "/games", label: "Daily games", icon: CalendarDays },
  { href: "/players", label: "Find your people", icon: Users },
  { href: "/products", label: "The pro shop", icon: ShoppingBag },
  { href: "/coaching", label: "Get coached", icon: GraduationCap },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/medical", label: "Player care", icon: HeartPulse },
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

export function DemoShell({ children, playerName }: { children: React.ReactNode; playerName: string | null }) {
  const pathname = usePathname();
  const signedIn = playerName !== null;
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const { count, ready } = useCart();
  const section = pathname.split("/")[1];
  const sectionNote = sectionNotes[section];
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    const unlock = lockScroll();
    return () => { unlock(); dialog.current?.close(); toggle.current?.focus(); };
  }, [open]);
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  const nav = (mobile = false) => <nav aria-label={mobile ? "All sections" : "Player navigation"}>{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active(href) ? "page" : undefined}><Icon size={19} /><span>{label}</span>{active(href) && <span className="demo-nav-dot" />}</Link>)}<div className="demo-nav-divider" /><Link href="/dashboard?tab=wallet" onClick={() => setOpen(false)}><Wallet size={19} />Wallet & payments</Link><Link href="/dashboard/profile" onClick={() => setOpen(false)}><UserRound size={19} />My player profile</Link><Link href="/about" onClick={() => setOpen(false)}><ArrowUpRight size={19} />The Sparvic story</Link></nav>;
  return <div data-demo-page={pathname.split("/")[1] || "home"} className={`demo-ui ${signedIn ? "demo-member" : "demo-guest"}`}>
    <ReadProgress />
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
    </div>
    <a className="demo-skip" href="#main-content">Skip to content</a>
    <header className="demo-header">
      <div className="demo-brand"><Logo height={42} priority /><span className="demo-brand-caption">THE PICKLEBALL CLUB</span></div>
      {!signedIn && <nav className="demo-public-nav" aria-label="Main navigation">{links.slice(1, 6).map(l => <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined}>{l.label}</Link>)}</nav>}
      {signedIn && <div className="demo-header-context"><span className="demo-live-dot" />Your club. One place.<small><MapPin size={12} /> Kolkata, India</small></div>}
      <div className="demo-header-actions"><Link href="/cart" className="demo-icon-button" aria-label={`Shopping bag${ready && count ? `, ${count} items` : ""}`}><ShoppingBag size={20} />{ready && count > 0 && <b>{count}</b>}</Link><Link href={signedIn ? "/dashboard" : "/login"} className="demo-account" aria-label={signedIn ? `Account for ${playerName}` : "Sign in"}><UserRound size={17} /><span>{signedIn ? playerName.split(" ")[0] : "Sign in"}</span></Link><button ref={toggle} className="demo-menu-button" onClick={() => setOpen(true)} aria-label="Open all sections" aria-expanded={open}><Menu size={21} /></button></div>
    </header>
    {signedIn && <aside className="demo-sidebar"><p className="demo-nav-label">LET’S PLAY</p>{nav()}<div className="demo-sidebar-note"><span>MAKE TIME<br />FOR PLAY.</span><p>Your next good day starts on court.</p><Link href="/games">Find a game <ArrowUpRight size={16} /></Link></div></aside>}
    <div className="demo-body"><main id="main-content" tabIndex={-1}>{sectionNote && <div className={`demo-section-ribbon demo-ribbon-${section}`}><span>{sectionNote.label}</span><p>{sectionNote.note}</p><span className="demo-ribbon-court" aria-hidden="true" /></div>}{children}</main>{signedIn ? <footer className="demo-member-footer"><Logo height={25} href={null} /><span>© {new Date().getFullYear()} {SITE.legalName}</span><Link href="/about">Our story</Link><Link href="/coach/login">Coach portal</Link><a href={`mailto:${SITE.email}`}>Contact the club</a></footer> : <SiteFooter surface="demo" />}</div>
    <dialog ref={dialog} aria-label="All sections" className="demo-drawer" onCancel={() => setOpen(false)} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}><div className="demo-drawer-head"><Logo height={38} /><button className="demo-icon-button" onClick={() => setOpen(false)} aria-label="Close menu"><X size={22} /></button></div>{nav(true)}<Link className="btn-volt mt-6 w-full" href={signedIn ? "/dashboard" : "/signup"} onClick={() => setOpen(false)}>{signedIn ? "My clubhouse" : "Join the club"}<ArrowUpRight size={17} /></Link><div className="demo-drawer-support"><p>Need a hand? Ask the caddy or talk to the club.</p><FloatingActions /></div></dialog>
    {signedIn && <nav className="demo-bottom-nav" aria-label="Quick navigation">{[links[0], links[1], links[2], { href: "/dashboard", label: "You", icon: UserRound }].map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}><Icon size={20} /><span>{label === "Find your people" ? "Community" : label === "Daily games" ? "Play" : label === "Clubhouse" ? "Home" : label}</span></Link>)}</nav>}
    <div className="demo-support"><FloatingActions /></div>
    <Suspense fallback={null}><WelcomePopup demo /></Suspense>
  </div>;
}

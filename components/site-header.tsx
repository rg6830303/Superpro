"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { useCart } from "@/components/cart-provider";
import { NAV_LINKS } from "@/lib/site";

/**
 * The active section is marked by a volt rail that slides between items rather
 * than a background pill on each — one moving object instead of six static
 * states, and the movement itself tells you where you just came from.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [rail, setRail] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const background = document.querySelector<HTMLElement>("[data-menu-content]");
    const wasInert = background?.inert ?? false;
    if (background) background.inert = true;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); }
      if (event.key === "Tab") {
        const targets = Array.from(headerRef.current?.querySelectorAll<HTMLElement>('a[href], button') ?? []).filter(el => el.getClientRects().length > 0);
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const wide = window.matchMedia("(min-width: 1280px)");
    const closeOnWide = () => { if (wide.matches) setOpen(false); };
    wide.addEventListener("change", closeOnWide);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      if (background) background.inert = wasInert;
      window.removeEventListener("keydown", closeOnEscape);
      wide.removeEventListener("change", closeOnWide);
    };
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Measure the active item so the rail moves in real pixels.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLAnchorElement>("[data-active='true']");
      setRail(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  return (
    <>
    {open && <button type="button" className="fixed inset-0 z-[45] bg-ink/30 lg:hidden" aria-label="Close navigation backdrop" tabIndex={-1} onClick={() => { setOpen(false); toggleRef.current?.focus(); }} />}
    <header
      ref={headerRef}
      className={`surface-glass sticky top-0 z-50 border-b transition-[border-color,box-shadow] duration-300 ${
        scrolled ? "border-line shadow-[0_14px_40px_-30px_rgba(6,38,61,0.7)]" : "border-transparent"
      }`}
    >
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-3 focus:text-white">Skip to content</a>
      <div className="wrap flex h-[72px] items-center justify-between gap-2 sm:gap-4">
        <Logo height={30} priority />

        <nav aria-label="Main navigation" ref={navRef} className="relative hidden items-center gap-0.5 lg:flex xl:gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-active={isActive(link.href)}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-200 xl:px-3.5 xl:text-[14px] ${
                isActive(link.href) ? "text-ink" : "text-ink/55 hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {rail && (
            <span
              aria-hidden
              className="absolute -bottom-px h-[3px] rounded-full bg-volt transition-all duration-300 ease-out"
              style={{ left: rail.left, width: rail.width }}
            />
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/cart"
            aria-label={`Cart${ready && count ? `, ${count} items` : ""}`}
            className="relative grid h-11 w-11 place-items-center rounded-full text-ink/65 transition-colors hover:bg-mist hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt"
          >
            <ShoppingBag size={19} />
            {ready && count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] animate-score-pop items-center justify-center rounded-full bg-volt px-1 font-mono text-[10px] font-medium tabular-nums text-ink">
                {count}
              </span>
            )}
          </Link>

          <Link
            href="/dashboard"
            aria-label="Your account"
            className="hidden rounded-full p-2.5 text-ink/65 transition-colors hover:bg-mist hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt sm:block"
          >
            <User size={19} />
          </Link>

          <Link href="/games" className="btn-volt btn-sm ml-1 hidden sm:inline-flex">
            Book a slot
          </Link>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            className="grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-navigation" className="surface-glass absolute inset-x-0 top-full max-h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain border-t border-line shadow-[0_20px_50px_-30px_rgba(6,38,61,0.7)] lg:hidden">
          <nav aria-label="Mobile navigation" className="wrap flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`border-b border-line/70 py-3.5 text-[15px] font-medium last:border-0 ${
                  isActive(link.href) ? "text-volt-deep" : "text-ink/75"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/dashboard" className="py-3.5 text-[15px] font-medium text-ink/75">
              My account
            </Link>
            <Link href="/games" className="btn-volt my-3">
              Book a slot
            </Link>
          </nav>
        </div>
      )}
    </header>
    </>
  );
}

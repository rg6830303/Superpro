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
  const [rail, setRail] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => setOpen(false), [pathname]);

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
    <header
      className={`sticky top-0 z-50 border-b bg-paper transition-[border-color,box-shadow] duration-300 ${
        scrolled ? "border-line shadow-[0_1px_0_rgba(6,38,61,0.04)]" : "border-transparent"
      }`}
    >
      <div className="wrap flex h-[72px] items-center justify-between gap-6">
        <Logo height={30} priority />

        <nav ref={navRef} className="relative hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-active={isActive(link.href)}
              className={`rounded-md px-3.5 py-2 text-[14px] font-medium transition-colors duration-200 ${
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
            className="relative rounded-full p-2.5 text-ink/65 transition-colors hover:bg-mist hover:text-ink"
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
            className="hidden rounded-full p-2.5 text-ink/65 transition-colors hover:bg-mist hover:text-ink sm:block"
          >
            <User size={19} />
          </Link>

          <Link href="/games" className="btn-volt btn-sm ml-1 hidden sm:inline-flex">
            Book a slot
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="rounded-full p-2.5 text-ink lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-paper lg:hidden">
          <nav className="wrap flex flex-col py-2">
            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ animationDelay: `${i * 32}ms` }}
                className={`animate-wipe-in border-b border-line/70 py-3.5 text-[15px] font-medium last:border-0 ${
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
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { useCart } from "@/components/cart-provider";
import { NAV_LINKS } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled ? "border-white/10 bg-ink/90 backdrop-blur-xl" : "border-transparent bg-ink/60 backdrop-blur-sm"
      }`}
    >
      <div className="wrap flex h-[68px] items-center justify-between gap-4">
        <Logo height={30} priority />

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive(link.href) ? "bg-white/10 text-bone" : "text-bone/60 hover:bg-white/5 hover:text-bone"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            aria-label={`Cart${ready && count ? `, ${count} items` : ""}`}
            className="relative rounded-full p-2.5 text-bone/70 transition-colors hover:bg-white/5 hover:text-bone"
          >
            <ShoppingBag size={19} />
            {ready && count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">
                {count}
              </span>
            )}
          </Link>

          <Link
            href="/dashboard"
            aria-label="Your account"
            className="hidden rounded-full p-2.5 text-bone/70 transition-colors hover:bg-white/5 hover:text-bone sm:block"
          >
            <User size={19} />
          </Link>

          <Link href="/games" className="btn-gold btn-sm hidden sm:inline-flex">
            Book a slot
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="rounded-full p-2.5 text-bone lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-ink lg:hidden">
          <nav className="wrap flex flex-col py-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-3 text-sm font-medium ${
                  isActive(link.href) ? "bg-white/10 text-gold" : "text-bone/70"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/dashboard" className="rounded-lg px-3 py-3 text-sm font-medium text-bone/70">
              My account
            </Link>
            <Link href="/games" className="btn-gold mt-2">
              Book a slot
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

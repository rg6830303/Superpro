"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  Settings,
  ShoppingCart,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/games", label: "Daily games", icon: CalendarDays },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/coaching", label: "Coaching", icon: GraduationCap },
  { href: "/admin/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/admin/players", label: "Players", icon: Users },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // The login screen renders bare — no nav, nothing to leak before auth.
  if (pathname === "/admin/login") {
    return <div className="min-h-screen">{children}</div>;
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-white/10 bg-ink-900 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Logo height={24} href="/admin" />
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
            Admin
          </span>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.href) ? "bg-gold/15 text-gold" : "text-bone/55 hover:bg-white/5 hover:text-bone"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 p-3">
          <LogoutButton admin />
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/10 bg-ink/90 px-5 backdrop-blur-xl lg:hidden">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation" className="p-2 text-bone">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Logo height={22} href="/admin" />
        </header>

        <main className="p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

/** Page header used across the console. */
export function AdminHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl">{title}</h1>
        {sub && <p className="mt-1.5 text-sm text-bone/50">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "gold" | "warn";
}) {
  const tones = {
    default: "text-bone",
    gold: "text-gold",
    warn: "text-danger",
  } as const;
  return (
    <div className="card p-5">
      <p className="text-[11px] uppercase tracking-wider text-bone/40">{label}</p>
      <p className={`mt-2 font-display text-4xl ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-bone/40">{hint}</p>}
    </div>
  );
}

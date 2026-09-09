"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BellRing,
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
  { href: "/admin/announcements", label: "Announcements", icon: BellRing },
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
        className={`fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-line bg-paper transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <Logo height={24} href="/admin" />
          <span className="rounded-pill bg-ink px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-paper">
            Admin
          </span>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`relative flex items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-sm font-medium transition-colors before:absolute before:left-0 before:top-1/2 before:h-0 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-volt before:transition-[height] before:duration-200 before:content-[''] ${
                isActive(item.href)
                  ? "bg-mist text-ink before:h-[60%]"
                  : "text-ink/65 hover:bg-mist/70 hover:text-ink"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-line p-3">
          <LogoutButton admin />
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-paper px-5 lg:hidden">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation" className="p-2 text-ink">
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        <h1 className="text-[2.5rem] leading-none">{title}</h1>
        {sub && <p className="mt-2.5 text-sm text-ink/60">{sub}</p>}
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
  tone?: "default" | "accent" | "warn";
}) {
  const tones = {
    default: "text-ink",
    accent: "text-volt-deep",
    warn: "text-signal",
  } as const;
  return (
    <div className="card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">{label}</p>
      <p className={`mt-2.5 font-display text-4xl tabular-nums leading-none ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-ink/50">{hint}</p>}
    </div>
  );
}

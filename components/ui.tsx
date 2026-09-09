"use client";

import { Check, Loader2 } from "lucide-react";

// The scroll-reveal primitive lives in components/motion.tsx alongside the rest
// of the motion toolkit; re-exported here so older call sites keep working.
export { Reveal } from "@/components/motion";

export function SectionHeading({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  /** Kept for call-site compatibility; headings are always left-set now. */
  align?: "left" | "center";
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 className="rule-head text-4xl sm:text-5xl">{title}</h2>
        {sub && <p className="lede mt-4">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Progress rail for the booking flows.
 *
 * The completed portion is drawn as one continuous volt line that grows with
 * each step, so progress reads as a single filling bar rather than a row of
 * disconnected dots — and the current step's marker holds a quiet pulse so the
 * eye finds it without a colour change.
 */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="scroll-x mb-9 flex items-center gap-2 no-scrollbar" aria-label="Progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="relative flex">
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-pulse-ring rounded-full bg-volt/40"
                  />
                )}
                <span
                  aria-current={active ? "step" : undefined}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full font-mono text-[12px] tabular-nums transition-colors duration-300 ${
                    done
                      ? "bg-volt text-ink"
                      : active
                        ? "bg-ink text-paper"
                        : "border border-line bg-paper text-ink/40"
                  }`}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : n}
                </span>
              </span>
              <span
                className={`hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] transition-colors sm:block ${
                  active ? "text-ink" : done ? "text-ink/60" : "text-ink/35"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-volt transition-[width] duration-500 ease-out"
                  style={{ width: done ? "100%" : "0%" }}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden />;
}

export function EmptyState({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink/75">{title}</p>
      {sub && <p className="max-w-sm text-sm leading-relaxed text-ink/55">{sub}</p>}
      {action}
    </div>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "ok" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    error: "border-signal/35 bg-signal/8 text-signal",
    ok: "border-volt-deep/30 bg-volt-soft text-volt-deep",
    info: "border-line bg-mist text-ink/75",
  } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`animate-wipe-in rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

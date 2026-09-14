import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";

/**
 * Shown where a signed-in account is required.
 *
 * Booking is tied to an account so a player's name, rating and history follow
 * them — which is what makes rosters, level bands and the wallet work at all.
 * The `next` parameter returns them here the moment they are in.
 */
export function SignInGate({
  title,
  detail,
  next,
}: {
  title: string;
  detail: string;
  next: string;
}) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-volt-soft text-volt-deep">
        <LogIn size={20} />
      </span>
      <h2 className="headline-section mt-5">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink/65">{detail}</p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="btn-volt">
          Create an account <ArrowRight size={16} />
        </Link>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-outline">
          I already have one
        </Link>
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-ink/45">
        Takes about a minute. Your rating decides which courts you can join, and your name shows on the slot so
        others know who they are playing with.
      </p>
    </div>
  );
}

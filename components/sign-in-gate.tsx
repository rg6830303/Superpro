import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";

/**
 * The website is view-only: games, coaching, tournaments and clinic visits are
 * booked inside the member clubhouse. This card sends visitors there: guests
 * create an account or sign in (and land on the clubhouse page), members go
 * straight in.
 */
export function SignInGate({
  title,
  detail,
  next,
  signedIn = false,
}: {
  title: string;
  detail: string;
  /** The clubhouse page that does the booking, e.g. /dashboard/play. */
  next: string;
  signedIn?: boolean;
}) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-volt-soft text-volt-deep">
        <LogIn size={20} />
      </span>
      <h2 className="headline-section mt-5">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink/65">{detail}</p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {signedIn ? (
          <Link href={next} className="btn-volt">
            Book in your clubhouse <ArrowRight size={16} />
          </Link>
        ) : (
          <>
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className="btn-volt">
              Create an account <ArrowRight size={16} />
            </Link>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-outline">
              I already have one
            </Link>
          </>
        )}
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-ink/45">
        {signedIn
          ? "Bookings and payments live in your clubhouse, with your wallet and history."
          : "Takes about a minute. Bookings and payments happen in your member clubhouse, so your name, rating and history stay in one place."}
      </p>
    </div>
  );
}

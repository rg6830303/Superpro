import Link from "next/link";
import { Trophy } from "lucide-react";

/**
 * A one-line Sparvic Open pill that sits inline beside an existing label, so
 * it adds no height and moves nothing around it.
 */
export function SparvicOpenMini({ href }: { href: string }) {
  return (
    <Link href={href} className="so-mini" aria-label="Sparvic Open Tournament, 30 October to 1 November: see the tournament tab">
      <Trophy size={11} aria-hidden="true" />
      <span>Sparvic Open<i> · 30 Oct–1 Nov</i></span>
      <b>Register →</b>
      <b className="so-mini-arrow">→</b>
    </Link>
  );
}

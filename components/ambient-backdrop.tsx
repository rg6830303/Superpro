/**
 * The moving part of the page background.
 *
 * One fixed, inert, server-rendered layer with no JavaScript, carrying both
 * halves of the page background: the two still washes of light, and the only
 * motion — a court grid creeping by exactly one tile a minute and two discs
 * of colour drifting a few viewport percent and returning. Every loop ends on
 * its own first frame, so there is no seam to catch the eye.
 *
 * Everything moves on `transform` alone, inside a `contain: strict` layer the
 * compositor can leave alone while the page scrolls. Phones get the still
 * washes only; `prefers-reduced-motion` stops the rest everywhere.
 */
export function AmbientBackdrop() {
  return (
    <div aria-hidden className="ambient" data-ambient>
      <div className="ambient-grid" />
      <div className="ambient-orb ambient-orb-volt" />
      <div className="ambient-orb ambient-orb-ink" />
    </div>
  );
}

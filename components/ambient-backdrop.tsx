/**
 * The moving part of the page background.
 *
 * The paper already carries two fixed washes and a court grid (see
 * `globals.css`). This adds the slowest possible motion to them: the grid
 * creeps by exactly one tile, and two discs of colour drift a few pixels and
 * come back. Every loop returns to its own first frame, so there is no seam
 * and no restart to catch the eye — at these speeds the page simply never
 * looks frozen.
 *
 * It is one fixed, inert layer behind everything, rendered on the server with
 * no JavaScript at all. Nothing here animates a property that would cost a
 * layout or a paint: the grid moves on `transform`, the discs on `transform`,
 * and the blur that softens them is applied once and never animated.
 *
 * It stops entirely under `prefers-reduced-motion`, and the discs stand still
 * on phones, where a blurred compositor layer is the most expensive thing on
 * the page and the least visible.
 */
export function AmbientBackdrop() {
  return (
    <div aria-hidden className="ambient" data-ambient>
      <div className="ambient-grid" />
      <div className="ambient-orb ambient-orb-volt" />
      <div className="ambient-orb ambient-orb-ink" />
      <div className="ambient-sheen" />
    </div>
  );
}

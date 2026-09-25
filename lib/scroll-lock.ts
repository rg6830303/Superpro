/**
 * Stop the page scrolling behind a menu, drawer or intro.
 *
 * Locks on <html>, never <body>. `overflow: hidden` on the body turns it into a
 * scroll container of its own; the sticky header then pins to the body — which
 * has never scrolled — instead of the window, and jumps back to the top of the
 * document. That is what made the phone menu open 1,500px above the reader
 * once they had scrolled down. On the root element, overflow applies to the
 * viewport itself, so nothing becomes a new container and sticky keeps working.
 *
 * Counted, so a drawer opened over a menu does not unlock the page when either
 * one closes first.
 */
let locks = 0;
let previous = "";

export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  if (locks === 0) {
    previous = root.style.overflow;
    root.style.overflow = "hidden";
  }
  locks++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) root.style.overflow = previous;
  };
}

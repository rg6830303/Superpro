"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

/**
 * The hero fidget: a paddle you can grab and spin.
 *
 * Drag rotates it on the Y axis with momentum; let go and the spin decays and
 * settles back to face-on. It idles with a slow drift so the page is never
 * completely still, and it flips to the spec face at a quarter turn — the toy
 * is also the product shot.
 *
 * Reduced-motion users get a static, face-on paddle with no drift.
 */
export function Paddle3D({ priority = false }: { priority?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const angle = useRef(-16);
  const velocity = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const raf = useRef<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [grabbed, setGrabbed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.style.transform = "rotateY(-16deg) rotateX(4deg)";
      return;
    }

    let idle = 0;
    const loop = () => {
      if (!dragging.current) {
        // Friction, then a gentle pull back to rest so it never ends up edge-on.
        velocity.current *= 0.94;
        if (Math.abs(velocity.current) < 0.05) {
          idle += 0.0055;
          const rest = -16 + Math.sin(idle) * 7;
          angle.current += (rest - angle.current) * 0.035;
        }
      }
      angle.current += velocity.current;

      const normalised = ((angle.current % 360) + 360) % 360;
      setFlipped(normalised > 90 && normalised < 270);

      const tiltX = 4 + Math.sin(angle.current / 90) * 3;
      el.style.transform = `rotateY(${angle.current.toFixed(2)}deg) rotateX(${tiltX.toFixed(2)}deg)`;
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    setGrabbed(true);
    lastX.current = e.clientX;
    velocity.current = 0;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    angle.current += dx * 0.55;
    velocity.current = dx * 0.35;
  }
  function onPointerUp() {
    dragging.current = false;
    setGrabbed(false);
  }

  return (
    <div className="relative select-none">
      <div className="scene mx-auto w-full max-w-[380px]">
        <div
          ref={ref}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="img"
          aria-label="SuperPro Champion Series T700 paddle — drag to spin"
          className={`preserve-3d relative aspect-[3/4] w-full touch-none ${
            grabbed ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {/* Face */}
          <div className="backface-hidden absolute inset-0 flex items-center justify-center">
            <Image
              src="/products/paddle-champion-t700.png"
              alt=""
              width={380}
              height={507}
              priority={priority}
              className="h-full w-auto object-contain drop-shadow-[0_28px_36px_rgba(6,38,61,0.22)]"
            />
          </div>

          {/* Spec face, sitting half a turn behind the paddle. */}
          <div
            className="backface-hidden absolute inset-0 flex items-center justify-center"
            style={{ transform: "rotateY(180deg)" }}
          >
            <div className="flex h-[86%] w-[64%] flex-col justify-between rounded-[46px] border border-line bg-ink p-6 text-paper shadow-lift">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-volt">Champion Series</p>
              <div>
                <p className="font-display text-5xl leading-none">T700</p>
                <p className="mt-1 font-mono text-[11px] text-paper/60">Toray carbon</p>
              </div>
              <dl className="space-y-2 font-mono text-[11px] text-paper/70">
                <div className="flex justify-between border-t border-paper/15 pt-2">
                  <dt>Core</dt>
                  <dd className="text-paper">16 mm</dd>
                </div>
                <div className="flex justify-between border-t border-paper/15 pt-2">
                  <dt>Weight</dt>
                  <dd className="text-paper">8.0 oz</dd>
                </div>
                <div className="flex justify-between border-t border-paper/15 pt-2">
                  <dt>Handle</dt>
                  <dd className="text-paper">5.3 in</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Contact shadow, tied to the flip so it reads as one object. */}
      <div
        aria-hidden
        className="mx-auto h-4 w-[55%] rounded-[100%] bg-ink/12 blur-md transition-all duration-500"
        style={{ transform: `scaleX(${flipped ? 0.8 : 1})` }}
      />

      <p className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45">
        <RotateCcw size={12} /> Drag to spin
      </p>
    </div>
  );
}

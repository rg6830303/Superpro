"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

export type SlideshowImage = { src: string; alt: string };

const INTERVAL_MS = 4500;

/**
 * An auto-advancing slideshow, built for a mixed set of landscape and
 * portrait photos: each slide is cross-faded (never slid), so a portrait shot
 * next to a landscape one never jumps the frame around.
 *
 * Autoplay pauses on hover, on keyboard focus inside the slide, and whenever
 * the tab is hidden — nobody wants a slideshow burning through frames in a
 * background tab — and stops for good under prefers-reduced-motion, leaving
 * the manual arrows and dots as the only way to move.
 */
export function MedicalSlideshow({ images }: { images: SlideshowImage[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const hovering = useRef(false);
  const focused = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    setPlaying(!mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const advance = useCallback((delta: number) => {
    setIndex((i) => (i + delta + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!playing || reduced || images.length <= 1) return;
    const id = window.setInterval(() => {
      if (hovering.current || focused.current) return;
      if (document.hidden) return;
      advance(1);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [playing, reduced, advance, images.length]);

  if (images.length === 0) return null;

  return (
    <div
      className="group relative overflow-hidden rounded-card border border-line bg-mist"
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
      onFocus={() => (focused.current = true)}
      onBlur={() => (focused.current = false)}
      role="region"
      aria-label="On-court medical assistance photos"
    >
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
        {images.map((img, i) => (
          <Image
            key={img.src}
            src={img.src}
            alt={img.alt}
            fill
            priority={i === 0}
            sizes="(max-width: 768px) 100vw, 800px"
            className={`object-cover transition-opacity duration-700 ease-out ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        ))}

        {/* A soft floor for the caption, not a hard bar. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink/70 to-transparent" />
        <p className="absolute bottom-3 left-4 right-16 text-sm font-medium text-paper drop-shadow-sm sm:bottom-4 sm:left-5">
          {images[index].alt}
        </p>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => advance(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-ink/50 text-paper opacity-0 transition-opacity duration-200 hover:bg-ink/70 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => advance(1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-ink/50 text-paper opacity-0 transition-opacity duration-200 hover:bg-ink/70 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause slideshow" : "Play slideshow"}
              aria-pressed={playing}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-ink/50 text-paper transition-colors hover:bg-ink/70"
            >
              {playing && !reduced ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 border-t border-line bg-paper py-3">
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to photo ${i + 1} of ${images.length}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-volt-deep" : "w-1.5 bg-line hover:bg-ink/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

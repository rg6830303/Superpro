"use client";

import { useEffect, useRef, useState } from "react";
import { isPortrait, welcomeFilm } from "@/components/welcome-intro";
import { Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

/** The welcome film with replay and sound controls, for the Intro tab. */
export function IntroPlayer() {
  const ref = useRef<HTMLVideoElement>(null);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [film, setFilm] = useState<{ src: string; poster: string; portrait: boolean } | null>(null);
  useEffect(() => {
    const portrait = isPortrait();
    setFilm({ ...welcomeFilm(portrait), portrait });
  }, []);
  const replay = () => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
    setEnded(false);
  };
  return (
    <div className={`intro-player ${film?.portrait ? "is-portrait" : ""}`}>
      <video
        ref={ref}
        src={film?.src}
        poster={film?.poster}
        autoPlay
        muted={muted}
        playsInline
        onEnded={() => setEnded(true)}
        onPlay={() => setEnded(false)}
      />
      {ended && (
        <button type="button" className="intro-player-replay" onClick={replay}>
          <RotateCcw size={18} /> Watch again
        </button>
      )}
      <div className="intro-player-bar">
        <button type="button" onClick={replay} aria-label="Play from the start"><Play size={16} /></button>
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Turn sound on" : "Mute"}>
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </div>
  );
}

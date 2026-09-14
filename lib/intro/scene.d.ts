/** Hand-written types for the Three.js entrance, which ships as plain JS. */
export type IntroApi = {
  play(): void;
  seek(t: number): void;
  dispose(): void;
  readonly playing: boolean;
  duration: number;
  version: string;
  mode: "threejs" | "reduced-motion" | "logo-fallback";
};

export function createIntro(options?: { forceFallback?: boolean }): Promise<IntroApi>;
export default createIntro;

import type { Config } from "tailwindcss";

/**
 * SuperPro design tokens.
 *
 * Three colours, no more: Prussian blue carries every piece of text and every
 * dark surface, paper/mist carry the page, and one fluorescent green is the
 * only saturated colour in the system — which is what lets it mean "act here"
 * wherever it appears. It is never used decoratively.
 *
 * Contrast: `ink` on paper is ~15:1. The opacity ramp stops at /45, the lowest
 * step that still clears AA at the sizes it is used on. Fluorescent green
 * cannot carry small text on white, so `volt` is for fills and rules while
 * `volt-deep` is the readable text green.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#06263D",
          950: "#02141F",
          900: "#041C2C",
          800: "#06263D",
          700: "#0A3B5C",
          600: "#10527E",
          500: "#1E6FA3",
          400: "#4A93C0",
          300: "#8FBEDA",
        },
        paper: "#FFFFFF",
        mist: {
          DEFAULT: "#EFF4F8",
          deep: "#E3EBF2",
        },
        line: {
          DEFAULT: "#D2DEE8",
          strong: "#B4C6D4",
        },
        volt: {
          DEFAULT: "#00E55F",
          bright: "#5BFF9C",
          deep: "#00913F",
          soft: "#E4FFEF",
        },
        signal: "#E03A2F",
        amber: "#C77B00",
      },
      fontFamily: {
        display: ["var(--font-display)", "Archivo", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.045em",
        display: "-0.03em",
      },
      boxShadow: {
        // Shadows sit in the blue family rather than neutral black.
        card: "0 1px 2px rgba(6,38,61,0.06), 0 12px 28px -18px rgba(6,38,61,0.28)",
        lift: "0 2px 4px rgba(6,38,61,0.08), 0 24px 48px -24px rgba(6,38,61,0.35)",
        press: "inset 0 2px 0 rgba(6,38,61,0.12)",
        volt: "0 14px 34px -16px rgba(0,229,95,0.55)",
      },
      borderRadius: {
        card: "18px",
        pill: "999px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translate3d(0, 22px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "wipe-in": {
          from: { opacity: "0", transform: "translate3d(0, 12px, 0) scale(0.985)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
        },
        "ball-bounce": {
          "0%, 100%": { transform: "translateY(0) scale(1, 1)" },
          "45%": { transform: "translateY(-38px) scale(0.94, 1.06)" },
          "50%": { transform: "translateY(-40px) scale(0.94, 1.06)" },
          "92%": { transform: "translateY(0) scale(1.08, 0.92)" },
        },
        "paddle-swing": {
          "0%, 100%": { transform: "rotate(-8deg)" },
          "50%": { transform: "rotate(10deg)" },
        },
        "spin-y": {
          from: { transform: "rotateY(0deg)" },
          to: { transform: "rotateY(360deg)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.7" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        "score-pop": {
          "0%": { transform: "translateY(8px) scale(0.8)", opacity: "0" },
          "60%": { transform: "translateY(-3px) scale(1.06)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "confetti-fall": {
          "0%": { transform: "translate3d(0,-10px,0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translate3d(var(--dx, 0px), 320px, 0) rotate(720deg)", opacity: "0" },
        },
        "shine-sweep": {
          from: { transform: "translateX(-120%) skewX(-18deg)" },
          to: { transform: "translateX(320%) skewX(-18deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(2deg)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.62s cubic-bezier(0.16,1,0.3,1) both",
        "wipe-in": "wipe-in 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "ball-bounce": "ball-bounce 1.5s cubic-bezier(0.32,0,0.67,1) infinite",
        "paddle-swing": "paddle-swing 2.6s ease-in-out infinite",
        "spin-y": "spin-y 14s linear infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.16,1,0.3,1) infinite",
        "score-pop": "score-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) both",
        "shine-sweep": "shine-sweep 1.1s cubic-bezier(0.16,1,0.3,1)",
        float: "float 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

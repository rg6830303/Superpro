import type { Config } from "tailwindcss";

/**
 * SuperPro palette. The logo is a monochrome white mark, and the product
 * photography is black paddle / white grip / gold badge / volt-yellow ball —
 * so the system is deliberately monochrome with two accents:
 *   gold  → primary accent (buttons, rules, price highlights)
 *   volt  → secondary accent (live/open states, sport energy)
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0A0A0B",
          900: "#0A0A0B",
          800: "#121214",
          700: "#1A1A1E",
          600: "#26262C",
          500: "#3A3A42",
          divider: "rgba(255,255,255,0.10)",
        },
        bone: {
          DEFAULT: "#F7F6F3",
          100: "#FFFFFF",
          200: "#F7F6F3",
          300: "#EAE8E2",
          400: "#D6D3CA",
        },
        gold: {
          DEFAULT: "#C79620",
          light: "#E5B93C",
          dark: "#9A7314",
        },
        volt: {
          DEFAULT: "#D7F035",
          dark: "#B4CC1F",
        },
        danger: "#E5484D",
        ok: "#3DD68C",
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        wider2: "0.14em",
      },
      boxShadow: {
        card: "0 24px 60px -32px rgba(0,0,0,0.75)",
        lift: "0 18px 40px -24px rgba(0,0,0,0.55)",
        gold: "0 18px 40px -20px rgba(199,150,32,0.45)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        marquee: "marquee 34s linear infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "pulse-soft": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      opacity: {
        "12": "0.12",
      },
    },
  },
  plugins: [],
};

export default config;

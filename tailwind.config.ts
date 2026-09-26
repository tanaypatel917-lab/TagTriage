import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#060b16",
        navy: { 950: "#060b16", 900: "#0a1326", 800: "#101b35", 700: "#17244a" },
        ice: { 200: "#d6ecff", 300: "#b3dcff" },
        signal: { DEFAULT: "#ff6b4a", deep: "#e04e2e" },
        dnr: { DEFAULT: "#7c3aed", ring: "#c4b5fd" },
        thinner: { DEFAULT: "#f97316" }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-grotesk)", "var(--font-inter)", "system-ui", "sans-serif"]
      },
      borderRadius: { card: "22px", control: "14px" },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.23, 1, 0.32, 1)",
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)"
      },
      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(0.99)" },
          to: { opacity: "1", transform: "none" }
        },
        "aurora-drift": {
          "0%": { transform: "translate3d(-4%, -2%, 0) scale(1)" },
          "100%": { transform: "translate3d(4%, 2%, 0) scale(1.08)" }
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "80%, 100%": { transform: "scale(1.14)", opacity: "0" }
        }
      },
      animation: {
        "rise-in": "rise-in 420ms cubic-bezier(0.23, 1, 0.32, 1) both",
        "aurora-drift": "aurora-drift 22s ease-in-out infinite alternate",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.23, 1, 0.32, 1) infinite"
      }
    }
  },
  plugins: []
};

export default config;

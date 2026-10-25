import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // Component variants are composed at runtime (e.g. `btn-${variant}`), so keep them out of purging.
  safelist: [{ pattern: /^(btn-(primary|secondary|ghost|danger|sm)|chip-(sky|red|emerald|amber|neutral)|triage-(RED|YELLOW|GREEN|BLACK))$/ }],
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
      animation: {
        "fade-in": "fade-in 160ms cubic-bezier(0.23, 1, 0.32, 1) both"
      }
    }
  },
  plugins: []
};

export default config;

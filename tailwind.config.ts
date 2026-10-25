import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // Component variants are composed at runtime (e.g. `btn-${variant}`), so keep them out of purging.
  safelist: [{ pattern: /^(btn-(primary|secondary|ghost|danger|sm)|chip-(sky|red|emerald|amber|neutral)|triage-(RED|YELLOW|GREEN|BLACK))$/ }],
  theme: {
    extend: {
      colors: {
        // `fg` is the foreground ink used for text, hairlines and tints; `paper` is the page.
        fg: "#0f1a2a",
        ink: "#0f1a2a",
        paper: { DEFAULT: "#f3eee4", card: "#fbf8f2", deep: "#e7dfcf" },
        signal: { DEFAULT: "#d7261e", deep: "#a3160f" },
        hivis: "#f4d70b",
        rescue: "#0d7a4a",
        sky: { 150: "#cfe2f3", 250: "#a9cbe8" },
        dnr: { DEFAULT: "#6d28d9", ring: "#c4b5fd" },
        thinner: { DEFAULT: "#ea6a0c" }
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      borderRadius: { card: "12px", control: "8px" },
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

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/context/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        "card-2": "var(--card-2)",
        border: "var(--border)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        muted: "var(--muted)",
        dim: "var(--dim)",
        text: "var(--text)",
        danger: "var(--danger)",
        warn: "var(--warn)",
        ok: "var(--ok)",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          DEFAULT: "#14110f",
          soft: "#2a251f",
        },
        paper: {
          DEFAULT: "#f4efe6",
          deep: "#eae0d2",
        },
        ember: {
          DEFAULT: "#d6552b",
          deep: "#a83c19",
        },
        moss: "#3f6b4f",
      },
      boxShadow: {
        hard: "4px 4px 0 0 #14110f",
        "hard-sm": "2px 2px 0 0 #14110f",
      },
    },
  },
  plugins: [],
};

export default config;

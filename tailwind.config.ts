import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#8E35A8",
          lilac: "#C58ADD",
          dark: "#4A145A",
          white: "#FFFCFF",
          light: "#F8F0FB",
          text: "#29212D",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(142, 53, 168, 0.15)",
        card: "0 8px 30px -4px rgba(74, 20, 90, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;

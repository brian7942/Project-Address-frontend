import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",   // ← src/ 사용
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
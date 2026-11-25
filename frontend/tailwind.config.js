/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#FFFBFB",
        ink: { DEFAULT: "#1F1D1E", soft: "#5C5659", faint: "#948D91" },
        coral: { DEFAULT: "#FF5C77", deep: "#E03855", light: "#FF8AA0", tint: "#FFF0F3" },
        mint: { DEFAULT: "#C8F2D5", deep: "#18532F", tint: "#EBF9F0", light: "#DDF7E5" },
        sky: { DEFAULT: "#BAE6FD", deep: "#1A749E", tint: "#F0F9FF", light: "#E0F2FE" },
        butter: { DEFAULT: "#FDE68A", deep: "#8C6A0B", tint: "#FEF9E7" },
        lilac: { DEFAULT: "#E9D5FF", deep: "#6D32A8", tint: "#FAF5FF" },
        blush: { DEFAULT: "#FBCFE8", deep: "#B8256E", tint: "#FFF1F8" },
        peach: { DEFAULT: "#FED7AA", deep: "#9A4A12", tint: "#FFF7ED" },
        line: "#F5E6EB",
      },
      fontFamily: {
        sans: ['Calibri', '"Times New Roman"', 'Candara', 'sans-serif'],
        serif: ['"Times New Roman"', 'Times', 'serif'],
        display: ['Calibri', '"Times New Roman"', 'sans-serif'],
      },
      boxShadow: {
        card: "0 6px 24px rgba(255, 92, 119, 0.06), 0 1px 4px rgba(0, 0, 0, 0.03)",
        "card-hover": "0 12px 32px rgba(255, 92, 119, 0.14), 0 2px 8px rgba(0, 0, 0, 0.04)",
        glow: "0 8px 24px rgba(255, 92, 119, 0.4)",
        mint: "0 8px 24px rgba(184, 240, 203, 0.5)",
      },
      borderRadius: {
        "2xl": "18px",
        "3xl": "26px",
        "4xl": "34px",
      },
    },
  },
  plugins: [],
};

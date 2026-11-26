/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F6F4",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#17161A", soft: "#5B575F", faint: "#8B8790" },
        line: "#E4E1DC",
        accent: {
          DEFAULT: "#8E1F45",
          hover: "#741733",
          deep: "#6E1734",
          tint: "#FAF0F3",
        },
        success: { DEFAULT: "#1F6B4A", tint: "#EDF6F1" },
        danger: { DEFAULT: "#9E2B25", tint: "#FBEFEE" },
      },
      fontFamily: {
        sans: ['"Segoe UI"', "Inter", "-apple-system", "BlinkMacSystemFont", '"Helvetica Neue"', "Arial", "sans-serif"],
        display: ["Georgia", "Cambria", '"Times New Roman"', "serif"],
        serif: ["Georgia", "Cambria", '"Times New Roman"', "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(23, 22, 26, 0.04)",
        lift: "0 10px 28px rgba(23, 22, 26, 0.10)",
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#F7F4EF",
        ink: { DEFAULT: "#302D2A", soft: "#6B655F", faint: "#9A938B" },
        rose: { DEFAULT: "#C58F9B", deep: "#A9707D", tint: "#F4E7EA" },
        sage: { DEFAULT: "#B9C7B3", deep: "#7E9577", tint: "#EAEFE7" },
        line: "#E9E3DC",
        sand: "#F1E9D8",
        lilac: "#ECE8F2",
      },
      fontFamily: {
        serif: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(48,45,42,0.04), 0 4px 16px rgba(48,45,42,0.04)",
      },
      borderRadius: { card: "14px" },
    },
  },
  plugins: [],
};

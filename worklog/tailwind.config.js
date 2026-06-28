/** @type {import('tailwindcss').Config} */
export default {
  // Dark mode follows the OS / browser preference, not a manual toggle.
  darkMode: "media",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Calm neutral + blue accent (Option A). Light value / dark value.
        accent: { light: "#185FA5", dark: "#5B9BD8" },
        working: { light: "#3B6D11", dark: "#7FB85A" },
        breakc: { light: "#A32D2D", dark: "#E07A7A" },
        idle: { light: "#5F5E5A", dark: "#A8A6A0" },
        // Shared secondary (terracotta) — identical in light and dark mode.
        secondary: "#d97757",
        // Warm off-white surfaces for light mode (no stark white).
        // `canvas` is the page; `surface` (slightly lighter) is cards/inputs.
        canvas: { light: "#F1E7D6" },
        surface: { light: "#F8F0E3" },
      },
      fontFamily: {
        // Desktop default; mobile layout overrides to prefer Roboto.
        sans: ["system-ui", "sans-serif"],
        roboto: ["Roboto", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

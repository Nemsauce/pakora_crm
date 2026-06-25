/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#020817",
        surface: "rgba(255,255,255,0.04)",
        surface2: "rgba(255,255,255,0.06)",
        border: "rgba(148,163,184,0.1)",
        muted: "#94A3B8",
        primary: "#38BDF8",
        primaryHover: "#0EA5E9",
        success: "#34D399",
        warning: "#FBBF24",
        danger: "#F87171"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

module.exports = config;

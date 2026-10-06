/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Noto Sans SC"',
          '"Source Han Sans SC"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: ['"Noto Serif SC"', "STSong", "Georgia", "serif"],
      },
      colors: {
        ink: {
          950: "#0c0a09",
          900: "#1c1917",
          800: "#292524",
        },
        cream: {
          50: "#fffbf5",
          100: "#fff1e0",
          200: "#ffe4c4",
        },
        brand: {
          coral: "#e85d4c",
          gold: "#c9a227",
          sage: "#2d6a4f",
          slate: "#334155",
        },
      },
      boxShadow: {
        soft: "0 4px 24px -4px rgba(0,0,0,0.12)",
        card: "0 8px 32px -8px rgba(28,25,23,0.15)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out forwards",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#3BB273",
          foreground: "#FFFFFF",
        },
        background: "#FFFFFF",
        foreground: "#000000",
        muted: {
          DEFAULT: "#F5F5F5",
          foreground: "#737373",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#000000",
        },
        border: "#E5E5E5",
      },
    },
  },
  plugins: [],
};


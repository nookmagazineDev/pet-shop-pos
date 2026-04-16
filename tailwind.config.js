/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#facc15", // yellow-400 (Golden yellow)
        "primary-foreground": "#422006", // yellow-950 (Dark brown for readable text)
      }
    },
  },
  plugins: [],
}

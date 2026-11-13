/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { archivo: ["Archivo", "sans-serif"] },
      colors: {
        background: "var(--background)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        ring: "var(--ring)",
        marca: "hsl(var(--marca) / <alpha-value>)",
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)" },
      animation: { "accordion-down": "accordion-down 0.2s ease-out" },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

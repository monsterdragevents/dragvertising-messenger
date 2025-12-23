/** @type {import('tailwindcss').Config} */
import designSystemPreset from "./tailwind-preset.js";

export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  presets: [designSystemPreset],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // All custom tokens (colors, borderRadius, spacing, fontSize, fontWeight, keyframes, animation, transitionDuration, transitionTimingFunction, boxShadow, backgroundImage)
      // are now managed by the designSystemPreset.
      // Any overrides or additional customisations can be added here.
    },
  },
  plugins: [require("tailwindcss-animate")],
}

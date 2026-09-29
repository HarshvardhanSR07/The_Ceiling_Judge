
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#0D0B14",
        glass: "rgba(255, 255, 255, 0.02)",
        indigo: {
          900: "#312E81",
        },
        accent: {
          purple: "#8B5CF6",
          cyan: "#22D3EE",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
}


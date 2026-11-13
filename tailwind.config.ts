import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#000000", // letras
        navy: "#031660", // inicio del degradado
        royal: "#2848c0",
        sky: "#6f87e1",
        brand: "#1800ad", // botones
        lamp: "#ffdd57", // aviso amarillo
        fog: "#e8ecf3",
        mist: "#c9d1db", // fondo de los campos
      },
      backgroundImage: {
        hero: "linear-gradient(180deg, #031660 0%, #2848c0 38%, #6f87e1 70%, #ffffff 100%)",
        side: "linear-gradient(180deg, #031660 0%, #1c3aa6 100%)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"], // League Spartan
        body: ["var(--font-body)", "system-ui", "sans-serif"], // Poppins
      },
    },
  },
  plugins: [],
};
export default config;

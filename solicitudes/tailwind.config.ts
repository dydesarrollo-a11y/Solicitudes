import type { Config } from "tailwindcss";

/**
 * Paleta corporativa Blender:
 *  - Amarillo  #FFDD00
 *  - Negro     #1D1D1B
 *  - Gris medio #B3B3B3
 *  - Blanco    #FFFFFF
 * El modo oscuro se activa con la clase `dark` en <html>.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: "#FFDD00",
          black: "#1D1D1B",
          gray: "#B3B3B3",
          white: "#FFFFFF"
        },
        // Estados de tiempo (timer)
        time: {
          ok: "#16A34A",
          warning: "#F59E0B",
          late: "#DC2626"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 3px rgba(29,29,27,0.08), 0 1px 2px rgba(29,29,27,0.06)",
        cardHover: "0 8px 24px rgba(29,29,27,0.12)"
      }
    }
  },
  plugins: []
};

export default config;

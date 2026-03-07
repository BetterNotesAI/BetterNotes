import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07090f",
        panel: "#101528",
        neon: "#7c90ff",
        mint: "#38d39f",
        rose: "#f4588a"
      },
      boxShadow: {
        glow: "0 0 80px rgba(124, 144, 255, 0.35)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(122, 133, 178, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(122, 133, 178, 0.12) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;

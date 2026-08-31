import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#05070A",
        cyanx: "#00D9FF",
        vio: "#7B61FF",
      },
    },
  },
  plugins: [],
};

export default config;

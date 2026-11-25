import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#120F0B",
        surface: "#1B1711",
        panel: "#231E17",
        raised: "#2B241B",
        ink: "#0C0A07",
        ivory: "#F4EEE6",
        muted: "#B8AA98",
        faint: "#80745F",
        line: "#342A20",
        brown: "#6B4A33",
        tan: "#B98A5E",
        deep: "#0E0B08",
        amber: "#F2A200",
        lightamber: "#FFC24D",
      },
    },
  },
  plugins: [],
} satisfies Config;

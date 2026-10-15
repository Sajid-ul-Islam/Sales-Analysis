import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
      },
      colors: {
        deepBlack: {
          DEFAULT: "#000000",
          pure: "#000000",
          surface: "#050505",
          card: "#0A0A0A",
          elevated: "#121212",
          border: "#1F1F1F",
          borderSubtle: "#161616",
          hover: "#171717"
        },
        primary: {
          DEFAULT: "#EB5A19",
          hover: "#D4490E",
          subtle: "#FFF7ED",
          dark: "#C8430E",
          50: "#FFF7ED",
          100: "#FFE6D5",
          500: "#EB5A19",
          600: "#D4490E",
          700: "#C8430E",
          900: "#702305"
        },
        brand: {
          50: "#FFF5ED",
          100: "#FFE6D5",
          500: "#EB5A19",
          600: "#D4490E",
          700: "#C8430E",
          900: "#702305"
        },
        navy: {
          deep: "#0F172A",
          surface: "#1E293B",
          card: "#111827",
          border: "#334155",
          850: "#0F172A",
          900: "#0B1120",
          950: "#060A13"
        },
        surface: {
          bg: "#F8FAFC",
          card: "#FFFFFF",
          border: "#E2E8F0",
          low: "#F1F5F9"
        },
        status: {
          delivered: "#059669",
          deliveredBg: "#ECFDF5",
          deliveredBorder: "#A7F3D0",
          returned: "#DC2626",
          returnedBg: "#FEF2F2",
          returnedBorder: "#FECACA",
          partial: "#D97706",
          partialBg: "#FFFBEB",
          partialBorder: "#FDE68A"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        headline: ["Plus Jakarta Sans", "Inter", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "sans-serif"]
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)'
      }
    },
  },
  plugins: [],
};
export default config;

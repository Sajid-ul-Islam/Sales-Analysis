import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DEEN Commerce | Sales & Return Reconciliation Engine',
  description: 'Next.js 14 Enterprise Multi-Carrier Reconciliation & Knapsack DP Partial Item Matching Engine for DEEN Commerce',
};

const criticalCSS = `
  :root {
    --primary: #EB5A19;
    --primary-hover: #D4490E;
    --primary-subtle: #FFF7ED;
    --brand-navy: #0F172A;
    --navy-deep: #0F172A;
    --navy-surface: #1E293B;
  }
  * {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    background-color: var(--bg-surface, #FFFFFF);
    color: #0F172A;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .table-container-responsive {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .min-w-0 {
    min-width: 0;
  }
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 9999px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #EB5A19;
  }
  .card-glow-primary {
    box-shadow: 0 0 25px -5px rgba(235, 90, 25, 0.12);
  }
  .card-glow-emerald {
    box-shadow: 0 0 25px -5px rgba(16, 185, 129, 0.12);
  }
`;

const tailwindConfigScript = `
  if (typeof window !== 'undefined' && window.tailwind) {
    window.tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
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
          }
        }
      }
    };
  }
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/jpeg" href="/deencommerce_logo.jpg" />
        <link rel="apple-touch-icon" href="/deencommerce_logo.jpg" />

        {/* Fail-safe Layer 1: Inlined Critical Resets & CSS Design Tokens */}
        <style id="critical-unbreakable-css" dangerouslySetInnerHTML={{ __html: criticalCSS }} />

        {/* Fail-safe Layer 2: Standalone Tailwind CDN Engine to guarantee zero CSS break */}
        <script src="https://cdn.tailwindcss.com"></script>
        <script id="tailwind-failsafe-config" dangerouslySetInnerHTML={{ __html: tailwindConfigScript }} />
      </head>
      <body className="bg-white min-h-screen text-slate-900 flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}

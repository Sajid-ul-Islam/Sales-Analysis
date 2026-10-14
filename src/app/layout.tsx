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

  /* Actual Deep Black Critical Theme Resets */
  html.dark, body.dark-canvas, .dark {
    color-scheme: dark;
    --bg-surface: #000000;
    --sidebar-surface: #050505;
    --card-surface: #0A0A0A;
    --border-surface: #1F1F1F;
    --text-surface: #F9FAFB;
  }
  html.dark, html.dark body, body.dark-canvas {
    background-color: #000000 !important;
    color: #F9FAFB !important;
  }
  .dark body, .dark main, .dark [style*="--bg-surface"] {
    background-color: #000000 !important;
  }
  .dark header, .dark nav, .dark aside {
    background-color: #050505 !important;
    border-color: #1F1F1F !important;
  }
  .dark .bg-white:not(.keep-white) {
    background-color: #0A0A0A !important;
    color: #F9FAFB;
  }
  .dark .bg-slate-50:not([class*="text-emerald"]):not([class*="text-rose"]):not([class*="text-amber"]):not([class*="text-blue"]):not([class*="text-purple"]):not([class*="text-indigo"]):not([class*="text-sky"]):not([class*="text-primary"]):not(.keep-white),
  .dark .bg-slate-100:not([class*="text-emerald"]):not([class*="text-rose"]):not([class*="text-amber"]):not([class*="text-blue"]):not([class*="text-purple"]):not([class*="text-indigo"]):not([class*="text-sky"]):not([class*="text-primary"]):not(.keep-white),
  .dark .bg-gray-50, .dark .bg-gray-100, .dark .bg-slate-50\/50, .dark .bg-slate-100\/90, .dark .bg-slate-200\/70 {
    background-color: #121212 !important;
  }
  .dark .border-slate-200, .dark .border-slate-200\/80, .dark .border-slate-200\/90, .dark .border-slate-100, .dark .border-slate-300, .dark .border-gray-200 {
    border-color: #1F1F1F !important;
  }
  .dark table {
    background-color: #0A0A0A !important;
    border-color: #1F1F1F !important;
  }
  .dark table thead tr, .dark table thead th {
    background-color: #0D0D0D !important;
    color: #9CA3AF !important;
    border-color: #1F1F1F !important;
  }
  .dark table tbody tr { border-color: #1A1A1A !important; }
  .dark table tbody tr:hover { background-color: #141414 !important; }
  .dark table td { border-color: #1A1A1A !important; }
  .dark .sticky.left-0 { background-color: #0A0A0A !important; }
  .dark thead .sticky.left-0 { background-color: #0D0D0D !important; }
  .dark table tbody tr:hover .sticky.left-0 { background-color: #141414 !important; }
  .dark input[type="text"], .dark input[type="search"], .dark input[type="number"], .dark select, .dark textarea {
    background-color: #0D0D0D !important;
    color: #F9FAFB !important;
    border-color: #262626 !important;
  }
  .dark .text-slate-900, .dark .text-slate-800, .dark .text-gray-900, .dark .text-gray-800, .dark .text-navy-deep { color: #F9FAFB !important; }
  .dark .text-slate-700, .dark .text-gray-700 { color: #E5E7EB !important; }
  .dark .text-slate-600, .dark .text-gray-600 { color: #D1D5DB !important; }
  .dark .text-slate-500, .dark .text-gray-500 { color: #9CA3AF !important; }
  .dark .text-slate-400, .dark .text-gray-400 { color: #71717A !important; }
  .dark .bg-emerald-50, .dark .bg-emerald-500\/10 { background-color: rgba(16, 185, 129, 0.14) !important; color: #34D399 !important; border-color: rgba(16, 185, 129, 0.28) !important; }
  .dark .bg-rose-50, .dark .bg-rose-500\/10 { background-color: rgba(244, 63, 94, 0.14) !important; color: #FB7185 !important; border-color: rgba(244, 63, 94, 0.28) !important; }
  .dark .bg-amber-50, .dark .bg-amber-500\/10 { background-color: rgba(245, 158, 11, 0.14) !important; color: #FBBF24 !important; border-color: rgba(245, 158, 11, 0.28) !important; }
  .dark .bg-blue-50, .dark .bg-blue-500\/10 { background-color: rgba(59, 130, 246, 0.14) !important; color: #60A5FA !important; border-color: rgba(59, 130, 246, 0.28) !important; }
  .dark .bg-purple-50, .dark .bg-purple-500\/10 { background-color: rgba(168, 85, 247, 0.14) !important; color: #C084FC !important; border-color: rgba(168, 85, 247, 0.28) !important; }
  .dark .bg-indigo-50, .dark .bg-indigo-50\/50, .dark .bg-indigo-500\/10 { background-color: rgba(99, 102, 241, 0.14) !important; color: #818CF8 !important; border-color: rgba(99, 102, 241, 0.28) !important; }
  .dark .bg-sky-50, .dark .bg-sky-500\/10 { background-color: rgba(14, 165, 233, 0.14) !important; color: #38BDF8 !important; border-color: rgba(14, 165, 233, 0.28) !important; }
  .dark .bg-orange-50, .dark .bg-orange-500\/10 { background-color: rgba(235, 90, 25, 0.14) !important; color: #FB923C !important; border-color: rgba(235, 90, 25, 0.28) !important; }
  .dark ::-webkit-scrollbar-track { background: #000000; }
  .dark ::-webkit-scrollbar-thumb { background: #262626; border-radius: 9999px; }
  .dark ::-webkit-scrollbar-thumb:hover { background: #EB5A19; }
`;

const tailwindConfigScript = `
  if (typeof window !== 'undefined' && window.tailwind) {
    window.tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
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

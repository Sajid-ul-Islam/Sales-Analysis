import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-headline',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ]
};

export const metadata: Metadata = {
  title: 'DEEN Commerce | Sales & Growth',
  description: 'Enterprise Sales Analytics & Real-Time Growth Intelligence for DEEN Commerce',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DEEN Sales & Growth',
  },
};

// Essential Critical CSS: inlined for fast paint before async CSS chunks load
const criticalCSS = `
  :root {
    --primary: #EB5A19;
    --primary-hover: #D4490E;
    --primary-subtle: #FFF7ED;
    --primary-dark: #C8430E;
    --brand-navy: #0F172A;
    --navy-deep: #0F172A;
    --navy-surface: #1E293B;
  }
  * {
    box-sizing: border-box;
  }
  html {
    overflow-y: scroll;
    scrollbar-gutter: stable;
  }
  html, body {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    background-color: var(--bg-surface, #FFFFFF);
    color: #0F172A;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  html.dark, body.dark-canvas {
    color-scheme: dark;
    background-color: #000000;
    color: #F9FAFB;
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakartaSans.variable}`}>
      <head>
        <link rel="icon" type="image/jpeg" href="/deencommerce_logo.jpg" />
        <link rel="apple-touch-icon" href="/deencommerce_logo.jpg" />

        {/* Inlined Critical Resets & CSS Tokens */}
        <style id="critical-unbreakable-css" dangerouslySetInnerHTML={{ __html: criticalCSS }} />

        {/* Anti-FOUC Theme Initializer */}
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var s = localStorage.getItem('deen_reconcile_theme_settings_v1');
                if (s && (s.indexOf('"dark-canvas"') !== -1 || s.indexOf('"darkModeCanvas":true') !== -1)) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.backgroundColor = '#000000';
                  document.documentElement.style.color = '#F9FAFB';
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="bg-white min-h-screen text-slate-900 flex flex-col font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

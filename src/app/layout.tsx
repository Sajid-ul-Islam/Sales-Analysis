import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DEEN Commerce | Sales & Return Reconciliation Engine',
  description: 'Next.js 14 Enterprise Multi-Carrier Reconciliation & Knapsack DP Partial Item Matching Engine for DEEN Commerce',
};

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
      </head>
      <body className="bg-white min-h-screen text-slate-900 flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}

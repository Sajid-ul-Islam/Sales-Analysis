/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/:path*.(jpg|jpeg|png|svg|webp|avif|ico|woff|woff2|ttf)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
        {
          key: 'CDN-Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
        {
          key: 'Vercel-CDN-Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],
  experimental: {
    serverComponentsExternalPackages: ['alasql'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native': false,
      'react-native-fs': false,
      'react-native-fetch-blob': false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      'react-native': false,
      'react-native-fs': false,
      'react-native-fetch-blob': false,
    };
    return config;
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const path = require('path');

const nextConfig = {
  experimental: {
    turbopack: false, // Disable for compatibility
  },
  // Temporarily disable TypeScript checking during build due to build worker module resolution issue
  typescript: {
    ignoreBuildErrors: true,
  },
  // TW-Enigma integration - now enabled for development too
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Note: Removed specific alias for @tw-enigma/scramble to allow proper TypeScript resolution
    // The package is linked via pnpm and should resolve normally

    // Ensure the module can be resolved
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // Add webpack optimizations for production
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
      };
    }

    // Performance monitoring
    if (dev) {
      config.plugins.push(new webpack.ProgressPlugin());
    }

    return config;
  },
  // Bundle analyzer
  ...(!process.env.ANALYZE && {}),
  // Enable source maps for development
  productionBrowserSourceMaps: false,
  // Optimize images
  images: {
    domains: ['images.unsplash.com', 'via.placeholder.com'],
  },
  // Add environment variables for development
  env: {
    TW_ENIGMA_ENABLED: process.env.NODE_ENV === 'production' ? 'true' : 'false',
    SCRAMBLE_ENABLED: process.env.NODE_ENV === 'production' ? 'true' : 'false',
    SCRAMBLE_DEBUG: process.env.NODE_ENV === 'development' ? 'true' : 'false',
  },
};

module.exports = withBundleAnalyzer(nextConfig);

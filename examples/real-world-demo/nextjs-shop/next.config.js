/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const path = require('path');

const nextConfig = {
  experimental: {
    turbopack: false, // Disable for compatibility
  },
  // TW-Enigma integration - now enabled for development too
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Add webpack resolver aliases for local packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@tw-enigma/scramble': path.resolve(
        __dirname,
        '../../../packages-private/scramble/dist/index.js'
      ),
    };

    // Ensure the module can be resolved
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // Add TW-Enigma webpack plugin (disabled in dev to prevent hydration mismatches)
    if (!isServer) {
      try {
        const { EnigmaWebpackPlugin } = require('@tw-enigma/core');

        config.plugins.push(
          new EnigmaWebpackPlugin({
            name: 'tw-enigma-nextjs-plugin',
            enabled: !dev, // Disable in development to prevent hydration mismatches
            priority: 10,
            buildTool: {
              type: 'webpack',
              autoDetect: true,
              development: {
                hmr: true,
                hmrDelay: 100,
                liveReload: true,
              },
              production: {
                sourceMaps: !dev, // Source maps in production only
                minify: !dev, // Minify in production only
                extractCSS: true,
              },
              webpack: {
                devServer: true,
                extractCSS: true,
                sourceMaps: true,
                cssLoader: {
                  modules: false,
                  importLoaders: 1,
                },
              },
            },
          })
        );

        console.log('✅ TW-Enigma webpack plugin loaded successfully');
      } catch (error) {
        console.warn('⚠️ Failed to load TW-Enigma webpack plugin:', error.message);
      }
    }

    return config;
  },
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

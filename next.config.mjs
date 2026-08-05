/** @type {import('next').NextConfig} */
const enableSourceMaps = process.env.ENABLE_SOURCE_MAPS === 'true';

const nextConfig = {
  output: 'standalone',
  // Opt-in only: browser source maps help debug production builds locally /
  // in staging. Leave ENABLE_SOURCE_MAPS unset in real public production.
  productionBrowserSourceMaps: enableSourceMaps,
  experimental: {
    // Server source maps for Node inspector when debugging `next start`.
    serverSourceMaps: enableSourceMaps,
  },
  logging: {
    fetches: {
      fullUrl: process.env.MINEARCHIVE_DEBUG === 'true',
    },
  },
};

export default nextConfig;

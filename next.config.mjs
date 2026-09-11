/** @type {import('next').NextConfig} */
const isVercel = Boolean(process.env.VERCEL);
const enableSourceMaps = process.env.ENABLE_SOURCE_MAPS === 'true';

const nextConfig = {
  // Standalone output is for Docker self-hosting only. Vercel uses its own tracing.
  ...(!isVercel ? { output: 'standalone' } : {}),
  poweredByHeader: false,
  compress: true,
  // Opt-in only. Leave ENABLE_SOURCE_MAPS unset on public Vercel production.
  productionBrowserSourceMaps: enableSourceMaps,
  experimental: {
    serverSourceMaps: enableSourceMaps,
  },
  logging: {
    fetches: {
      fullUrl: process.env.MINEARCHIVE_DEBUG === 'true',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;

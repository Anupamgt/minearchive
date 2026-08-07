/** @type {import('next').NextConfig} */
const isVercel = Boolean(process.env.VERCEL);

const nextConfig = {
  // Standalone output is for Docker self-hosting only. Vercel uses its own tracing.
  ...(!isVercel ? { output: 'standalone' } : {}),
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;

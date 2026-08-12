import type { NextConfig } from 'next';

/**
 * Security headers applied to every response.
 *
 * The CSP is intentionally strict. `'unsafe-inline'` is required for styles
 * because Next.js injects inline <style> tags for critical CSS; scripts do not
 * need it because we never use inline event handlers or inline <script> bodies
 * outside of Next's own nonce-less bootstrap, which is covered by
 * `'strict-dynamic'`-free `'self'` in production builds.
 */
const isDev = process.env.NODE_ENV === 'development';

const contentSecurityPolicy = [
  `default-src 'self'`,
  // Next.js requires 'unsafe-inline' for its bootstrap script in dev, and
  // 'unsafe-eval' for React Refresh. Neither is enabled in production.
  `script-src 'self' ${isDev ? `'unsafe-inline' 'unsafe-eval'` : `'unsafe-inline'`} https://js.stripe.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' blob: data: https:`,
  `font-src 'self' data:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `frame-src https://js.stripe.com https://hooks.stripe.com`,
  `connect-src 'self' https://api.stripe.com`,
  `upgrade-insecure-requests`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Fail the production build on type or lint errors rather than shipping them.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  experimental: {
    // Server Actions accept requests only from these origins.
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Public product/profile media served from the configured CDN or bucket.
      ...(process.env.NEXT_PUBLIC_MEDIA_HOST
        ? [
            {
              protocol: 'https' as const,
              hostname: process.env.NEXT_PUBLIC_MEDIA_HOST,
            },
          ]
        : []),
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Private areas must never be indexed, regardless of robots.txt.
        source: '/(dashboard|admin|library|favorites|checkout|orders)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;

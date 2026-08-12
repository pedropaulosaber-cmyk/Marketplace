import type { NextConfig } from 'next';

/**
 * Security headers are NOT set here.
 *
 * They live in `src/middleware.ts`, because the CSP carries a per-request
 * nonce and a static config can only ship a static policy — which in practice
 * means `'unsafe-inline'` on script-src, and a CSP with `'unsafe-inline'` on
 * script-src is not a CSP. Defining the policy in both places is worse than
 * defining it in either: when two `Content-Security-Policy` headers are
 * present the browser enforces both, so the static one would veto the very
 * scripts the nonced one allows, and the site would break in a way that only
 * shows up in production.
 *
 * The one header kept here is `X-Robots-Tag`, which is routing configuration
 * rather than a security policy and has no per-request component.
 */

/**
 * Origins allowed to invoke Server Actions.
 *
 * Next already rejects a Server Action whose `Origin` does not match `Host`,
 * which is the CSRF defence. Behind a proxy that rewrites Host — which is
 * exactly what Vercel and most ingress controllers do — that comparison can
 * fail open or fail closed depending on headers we do not control, so the
 * canonical origin is stated explicitly.
 */
function allowedOrigins(): string[] {
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return [];

  try {
    return [new URL(configured).host];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Removes the `X-Powered-By: Next.js` banner. Version disclosure turns a
  // future framework CVE into a targeted search rather than a broad scan.
  poweredByHeader: false,

  // Fail the production build on type or lint errors rather than shipping them.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  experimental: {
    serverActions: {
      // Uploads go straight to object storage through a signed URL, so no
      // action body has a legitimate reason to be large. A tight limit is a
      // cheap ceiling on memory-exhaustion attempts.
      bodySizeLimit: '2mb',
      allowedOrigins: allowedOrigins(),
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
        // Private areas must never be indexed, regardless of robots.txt. This
        // is defence against accidental exposure, not against an attacker.
        source: '/(dashboard|admin|library|favorites|checkout|orders)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;

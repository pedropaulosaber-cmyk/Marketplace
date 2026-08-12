import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * robots.txt.
 *
 * Private areas are disallowed here, and independently protected by an
 * `X-Robots-Tag: noindex` response header (next.config.ts) plus per-page
 * `robots` metadata. robots.txt alone is only a request — the header is what
 * actually keeps a page out of an index if it gets linked.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/admin',
          '/library',
          '/favorites',
          '/orders',
          '/checkout',
          '/login',
          '/register',
          '/api/',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}

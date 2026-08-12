import type { MetadataRoute } from 'next';
import { db } from '@/server/db/client';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Sitemap.
 *
 * Only publicly visible, indexable content is listed: published products,
 * active professional profiles and open demands. Private areas (dashboard,
 * admin, library, checkout) are excluded here and blocked in robots.txt and by
 * an X-Robots-Tag header — three independent layers, because an accidentally
 * indexed order page is a data leak.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, professionals, demands] = await Promise.all([
    db.product.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 5000,
    }),
    db.professionalProfile.findMany({
      where: { deletedAt: null, user: { status: 'ACTIVE', deletedAt: null } },
      select: { slug: true, updatedAt: true },
      take: 5000,
    }),
    db.demand.findMany({
      where: { deletedAt: null, status: { in: ['OPEN', 'IN_REVIEW'] } },
      select: { slug: true, updatedAt: true },
      take: 2000,
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/professionals`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/demands`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/sell`, changeFrequency: 'weekly', priority: 0.7 },
  ];

  return [
    ...staticRoutes,
    ...products.map((p) => ({
      url: `${BASE}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...professionals.map((p) => ({
      url: `${BASE}/professionals/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...demands.map((d) => ({
      url: `${BASE}/demands/${d.slug}`,
      lastModified: d.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.5,
    })),
  ];
}

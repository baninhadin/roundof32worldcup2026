import type { MetadataRoute } from 'next';

const SITE_URL = 'https://roundof32worldcup2026.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: 'daily',
      priority: 1,
    },
  ];
}

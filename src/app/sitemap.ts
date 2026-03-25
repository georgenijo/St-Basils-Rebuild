import type { MetadataRoute } from 'next'

const BASE_URL = 'https://stbasilsboston.org'

export default function sitemap(): MetadataRoute.Sitemap {
  // Phase 1 static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/first-time`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/giving`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  // TODO: Add dynamic routes for events pages
  // TODO: Add dynamic routes for announcements pages

  return staticPages
}

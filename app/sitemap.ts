import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/seo/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/product-intro'), lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
  ]
}

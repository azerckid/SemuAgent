import type { MetadataRoute } from 'next'

import { siteConfig } from '@/lib/seo/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 비공개·인증·토큰 경로는 색인 제외
      disallow: ['/dashboard/', '/api/', '/upload/', '/onboarding', '/jaryo-admin', '/pitch/'],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  }
}

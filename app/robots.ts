import type { MetadataRoute } from 'next'

const BASE_URL = 'https://jaaryo.online'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 비공개·인증·토큰 경로는 색인 제외
      disallow: ['/dashboard/', '/api/', '/upload/', '/onboarding', '/jaryo-admin', '/pitch/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}

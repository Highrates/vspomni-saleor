import type { NextConfig } from 'next'
import { buildCategorySlugRedirectRules } from './src/lib/seo/categorySlugRedirects'

/** Origin Nest API (для rewrites `/api/v1` и `/uploads` в dev / same-origin режиме). */
const NEST_ORIGIN = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://127.0.0.1:3011/api/v1'
  try {
    return new URL(raw).origin
  } catch {
    return 'http://127.0.0.1:3011'
  }
})()

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_UPLOADS_ORIGIN:
      process.env.NEXT_PUBLIC_UPLOADS_ORIGIN || 'same-origin',
    NEXT_PUBLIC_YANDEX_MAP_API_KEY:
      process.env.NEXT_PUBLIC_YANDEX_MAP_API_KEY,
  },
  async rewrites() {
    // `/api/v1/*` — App Router BFF (httpOnly buyer cookie → Bearer), не rewrite.
    return [
      { source: '/uploads/:path*', destination: `${NEST_ORIGIN}/uploads/:path*` },
    ]
  },
  async redirects() {
    return [
      ...buildCategorySlugRedirectRules(),
      { source: '/wb', destination: 'https://vspomni.mobz.click/wildberries', permanent: false },
      { source: '/ozon', destination: 'https://vspomni.mobz.click/ozon', permanent: false },
      { source: '/goldapple', destination: 'https://vspomni.mobz.click/goldapple', permanent: false },
      { source: '/lamoda', destination: 'https://vspomni.mobz.click/lamoda', permanent: false },
      { source: '/yandexmarket', destination: 'https://vspomni.mobz.click/yandexmarket', permanent: false },
      {
        source: '/article/korporativnye-podarki-2',
        destination: '/korporativnye-podarki',
        permanent: true,
      },
    ]
  },
  images: {
    // Не раздувать srcset до 3840 для карточек/иконок
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 84, 96, 128, 256, 384],
    // Nest отдаёт /uploads с 127.0.0.1 — оптимизатор по умолчанию блокирует локальные IP
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
      { protocol: 'https', hostname: '127.0.0.1', pathname: '/**' },
      { protocol: 'https', hostname: 'localhost', pathname: '/**' },
      {
        protocol: "https",
        hostname: "vspomni.store",
        pathname: "/**",
      }
    ],
  },
}

export default nextConfig

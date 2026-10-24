import type { Metadata } from 'next'
import CorporateGiftsPage from '@/components/corporate/CorporateGiftsPage'
import { buildPageMetadata } from '@/lib/seo/buildPageMetadata'

export const revalidate = 3600

export const metadata: Metadata = buildPageMetadata({
  title: 'Корпоративные подарки',
  description:
    'Корпоративные подарки ВСПОМНИ: брендирование, уникальные ароматы и упаковка из собственной производства в Санкт-Петербурге.',
  canonicalPath: '/korporativnye-podarki',
  ogImage: '/images/corporate-gifts/slide-01.webp',
})

export default function Page() {
  return <CorporateGiftsPage />
}

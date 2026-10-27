import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { buildPageMetadata } from '@/lib/seo/buildPageMetadata'
import { faqPageJsonLd } from '@/lib/seo/faqJsonLd'
import Hero from '@/components/home/Hero'
import GiftPackagesBanner from '@/components/home/GiftPackagesBanner'
import CollectionNoseBlock from '@/components/home/CollectionNoseBlock'
import StoryBlock from '@/components/features/StoryBlock'
import PopularScentsAlt from '@/components/features/PopularScentsAlt'
import ComingSoon from '@/components/features/ComingSoon'
import Choice from '@/components/home/Choice'
import Unpacking from '@/components/home/Unpacking'
import FaqBlock from '@/components/home/FaqBlock'
import FaqNoscript from '@/components/home/FaqNoscript'
import CandlesSoonBanner from '@/components/home/CandlesSoonBanner'
import { loadHomeCategoryPicks } from '@/lib/category/loadHomeCategoryPicks'
import { getCandlesSoonBanner } from '@/graphql/queries/candlesSoon.service'
import {
  getChoiceProducts,
  getNoseHomeProducts,
  getPopularProducts,
} from '@/graphql/queries/product.service'
import { getUnpackingHomeReels } from '@/lib/unpacking/getUnpackingHomeReels'
import { getAllFaqs } from '@/graphql/queries/faq.service'
import { getAllStories } from '@/graphql/queries/stories.service'
import { getAllAromas } from '@/graphql/queries/allAromas.service'
import { getAllArticles } from '@/graphql/queries/articles.service'
import { loadHeroSlides } from '@/lib/hero/loadHeroSlides'

const ChannelOneSection = dynamic(
  () => import('@/components/home/ChannelOneSection'),
  {
    loading: () => (
      <section
        className="mt-4 mb-4 min-h-[200px] sm:mt-6 sm:mb-6 sm:min-h-[300px] md:mt-8 md:mb-8 lg:mt-10 lg:mb-10"
        aria-hidden
      />
    ),
  },
)

const HistoryLine = dynamic(() => import('@/components/home/HistoryLine'), {
  loading: () => (
    <section
      className="mt-4 mb-4 min-h-[170px] sm:mt-6 sm:mb-6 sm:min-h-[240px] md:mt-8 md:mb-8 md:min-h-[300px] lg:mt-10 lg:mb-10 lg:min-h-[340px]"
      aria-hidden
    />
  ),
})

const ProductGrid = dynamic(() => import('@/components/home/ProductGrid'), {
  loading: () => (
    <section
      id="vse-aromaty"
      className="mt-4 mb-2 min-h-[120px] scroll-mt-20 sm:mt-6 sm:mb-3 md:mt-8 md:mb-4 lg:mt-10 lg:mb-5"
      aria-hidden
    />
  ),
})

const NewsBlock = dynamic(() => import('@/components/news/NewsBlock'), {
  loading: () => (
    <section className="mb-4 min-h-[200px] sm:mb-6 md:mb-8 lg:mb-10" aria-hidden />
  ),
})

// Обновляем главную страницу по данным моделей раз в минуту
export const revalidate = 60

const HOME_TITLE = 'Ароматы для дома и интерьера'
const HOME_DESCRIPTION =
  'Интерьерные ароматы для дома от бренда ВСПОМНИ: диффузоры, саше и декор — наполните пространство воспоминаниями и уютом.'

export const metadata: Metadata = buildPageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  canonicalPath: '/',
  ogImage: '/images/catalogTop.png',
})

export default async function Home() {
  const [
    candlesSoon,
    choiceProducts,
    categoryPicks,
    faqs,
    heroSlides,
    stories,
    popularProducts,
    allAromas,
    noseProducts,
    newsArticles,
    unpackingHome,
  ] = await Promise.all([
    getCandlesSoonBanner().catch(() => null),
    getChoiceProducts().catch(() => []),
    loadHomeCategoryPicks(),
    getAllFaqs().catch(() => []),
    loadHeroSlides().catch(() => []),
    getAllStories().catch(() => []),
    getPopularProducts().catch(() => []),
    getAllAromas().catch(() => []),
    getNoseHomeProducts().catch(() => []),
    getAllArticles(2).catch(() => []),
    getUnpackingHomeReels().catch(() => ({ items: [], total: 0 })),
  ])

  const faqJsonLd = faqPageJsonLd(faqs)

  return (
    <>
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}
      <FaqNoscript faqs={faqs} />
      <Hero initialSlides={heroSlides} />
      <StoryBlock initialStories={stories} />
      <PopularScentsAlt
        title={HOME_TITLE}
        heading="h1"
        initialProducts={popularProducts}
      />
      <ComingSoon initialCategories={categoryPicks.comingSoon} />
      <Choice initialProducts={choiceProducts} />
      <ChannelOneSection />
      <Unpacking
        initialItems={unpackingHome.items}
        initialTotal={unpackingHome.total}
      />
      <HistoryLine />
      <ProductGrid initialItems={allAromas} />
      <GiftPackagesBanner initialCategory={categoryPicks.giftPackages} />
      <CollectionNoseBlock initialProducts={noseProducts} />
      <CandlesSoonBanner
        imageUrl={candlesSoon?.imageUrl ?? null}
        bannerText={candlesSoon?.bannerText ?? candlesSoon?.title ?? null}
      />
      <NewsBlock initialArticles={newsArticles} />
      <FaqBlock initialFaqs={faqs} />
    </>
  )
}

import type { Metadata } from 'next'
import CatalogAllProductsSection from '@/components/catalog/CatalogAllProductsSection'
import CatalogCategoryBannersView from '@/components/catalog/CatalogCategoryBannersView'
import CatalogHero from '@/components/catalog/CatalogHero'
import CatalogPageNoscript from '@/components/catalog/CatalogPageNoscript'
import ProductGrid from '@/components/home/ProductGrid'
import PublicPageBreadcrumbs from '@/components/layout/PublicPageBreadcrumbs'
import {
  CATALOG_DESCRIPTION,
  CATALOG_PAGE_SIZE,
  CATALOG_TITLE,
} from '@/lib/catalog/catalogPageContent'
import { sortCatalogCategories } from '@/lib/category/catalogCategories'
import { loadAllCategories } from '@/lib/category/loadAllCategories'
import { breadcrumbCatalogPage } from '@/lib/seo/breadcrumbItems'
import { buildPageMetadata } from '@/lib/seo/buildPageMetadata'
import { catalogPageJsonLd } from '@/lib/seo/catalogJsonLd'
import { getAllAromas } from '@/graphql/queries/allAromas.service'
import { getCatalogProductsPage } from '@/graphql/queries/product.service'

export const metadata: Metadata = buildPageMetadata({
  title: CATALOG_TITLE,
  description: CATALOG_DESCRIPTION,
  canonicalPath: '/catalog',
  ogImage: '/images/catalogTop.png',
})

export const revalidate = 60

export default async function CatalogPage() {
  const [productsPage, categories, allAromas] = await Promise.all([
    getCatalogProductsPage(CATALOG_PAGE_SIZE).catch(() => ({
      products: [],
      hasNextPage: false,
      endCursor: null,
    })),
    loadAllCategories(),
    getAllAromas().catch(() => []),
  ])

  const sortedCategories = sortCatalogCategories(categories)
  const jsonLd = catalogPageJsonLd(sortedCategories, productsPage.products)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CatalogPageNoscript
        categories={sortedCategories}
        products={productsPage.products}
      />
      <div className="px-0 -mt-63 sm:-mt-74 md:-mt-90">
        <CatalogHero />
        <PublicPageBreadcrumbs
          items={breadcrumbCatalogPage()}
          currentPath="/catalog"
          variant="container"
          className="relative z-10 mb-4 sm:mb-6"
        />
        <CatalogCategoryBannersView categories={sortedCategories} />
        <ProductGrid initialItems={allAromas} />
        <CatalogAllProductsSection
          initialProducts={productsPage.products}
          initialHasNextPage={productsPage.hasNextPage}
          initialEndCursor={productsPage.endCursor}
        />
      </div>
    </>
  )
}

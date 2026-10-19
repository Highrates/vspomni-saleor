import { decodeUnicode } from '@/lib/functions'
import { normalizeAromaLabel } from '@/lib/normalizeAromaLabel'
import type { ProductDetailNode } from '@/graphql/types/product.types'
import { noteLayersForSeo } from '@/lib/product/aromaNotes'
import { isProductInStock } from '@/lib/product/stock'

type AttributeLike = NonNullable<ProductDetailNode['attributes']>[number]

export function getAttributeBySlug(
  attributes: AttributeLike[] | undefined,
  slug: string,
) {
  return attributes?.find((attr) => attr.attribute.slug === slug)
}

export function editorJsToPlainText(
  jsonString: string | undefined | null,
): string {
  if (!jsonString) return ''
  try {
    const decoded = decodeUnicode(jsonString)
    const parsed = JSON.parse(decoded)
    if (!Array.isArray(parsed?.blocks)) return ''
    return parsed.blocks
      .map((block: { data?: { text?: string } }) => {
        const text = block.data?.text
        if (!text) return ''
        return String(text).replace(/<[^>]+>/g, ' ')
      })
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

function attributePlainText(
  attributes: AttributeLike[] | undefined,
  slug: string,
): string {
  const attr = getAttributeBySlug(attributes, slug)
  const value = attr?.values?.[0]
  if (!value) return ''
  if (value.richText) return editorJsToPlainText(value.richText)
  return (value.name || value.plainText || value.value || '').trim()
}

export type ProductSeoContent = {
  name: string
  shortDescription: string
  descriptionPlain: string
  characteristicsPlain: string
  compositionPlain: string
  notes: { label: string; names: string[] }[]
  aromas: string[]
  price: number | null
  currency: string
  inStock: boolean
  sku: string | null
  imageUrls: string[]
  categoryName: string | null
}

export function extractProductSeoContent(
  product: ProductDetailNode,
): ProductSeoContent {
  const attributes = product.attributes
  const firstVariant = product.productVariants?.edges?.[0]?.node

  const aromas =
    getAttributeBySlug(attributes, 'aromaty-v-kartochke-tovara')?.values
      ?.map((v) => normalizeAromaLabel((v.name || v.value || '').trim()))
      .filter(Boolean) ?? []

  const notes = noteLayersForSeo(product.aromaNotes ?? [])

  const imageUrls = [
    ...(product.media?.map((m) => m.url).filter(Boolean) ?? []),
    product.thumbnail?.url,
  ].filter((url, i, arr): url is string => Boolean(url) && arr.indexOf(url) === i)

  return {
    name: product.name,
    shortDescription: attributePlainText(attributes, 'korotkoe-opisanie-tovara'),
    descriptionPlain: editorJsToPlainText(
      typeof product.description === 'string' ? product.description : '',
    ),
    characteristicsPlain: attributePlainText(attributes, 'harakteristiki'),
    compositionPlain: attributePlainText(attributes, 'sostav'),
    notes,
    aromas,
    price: firstVariant?.pricing?.price?.gross?.amount ?? null,
    currency: firstVariant?.pricing?.price?.gross?.currency ?? 'RUB',
    // Единый источник: isAvailableForPurchase + quantityAvailable (см. lib/product/stock).
    inStock: isProductInStock(product),
    sku: firstVariant?.sku ?? null,
    imageUrls,
    categoryName: product.category?.name?.trim() || null,
  }
}

export function productMetaDescription(seo: ProductSeoContent): string {
  const parts = [
    seo.shortDescription,
    seo.descriptionPlain,
    seo.aromas.length ? `Ароматы: ${seo.aromas.join(', ')}` : '',
  ].filter(Boolean)
  const text = parts.join('. ').replace(/\s+/g, ' ').trim()
  if (text.length <= 160) return text || seo.name
  return `${text.slice(0, 157)}…`
}

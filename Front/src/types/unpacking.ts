/** Карточка блока «Распаковка» на витрине. */
export type UnpackingReelItem = {
  id: string
  videoUrl: string
  posterUrl: string
  captionName: string
  /** Уже отформатированная дата для плашки (formatChoiceStarDate). */
  captionDate: string
  name: string
  size: string
  thumbnail: string
  price: number
  oldPrice: number
  slug: string
  categorySlug?: string
  variantId?: string | null
}

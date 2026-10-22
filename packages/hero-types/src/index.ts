/**
 * Единый словарь Hero:
 * - slide — основной баннер слайдера
 * - plaque — плашка поверх слайда (не badge / secondary / bottom banner)
 */

export type HeroPlaque = {
  title: string
  subtitle: string
  imageUrl: string
  href: string
}

/** Публичный / resolved слайд для витрины (GET /settings/hero). */
export type HeroSlide = {
  id: string
  imageUrl: string
  /** Всегда задан: своя мобильная или десктоп. */
  mobileImageUrl: string
  href: string
  plaque: HeroPlaque | null
}

/** Элемент списка в админке (GET/PUT settings/admin/hero). */
export type HeroSlideAdmin = {
  id: string
  imageUrl: string
  mobileImageUrl: string | null
  href: string
  plaque: HeroPlaque | null
  sortOrder: number
  active: boolean
  createdAt?: string
  updatedAt?: string
}

/** Шаблон плашки только для админки (заполнить пустые). Не fallback витрины. */
export type HeroPlaqueTemplate = {
  title: string
  subtitle: string
  imageUrl: string
  href: string
}

/** Пустой href слайда / плашки при сохранении → каталог (не deep-link). */
export const HERO_SLIDE_HREF_DEFAULT = '/catalog'
export const HERO_PLAQUE_HREF_DEFAULT = '/catalog'

/**
 * Seed шаблона плашки в админке / Prisma default (контент «заполнить пустые»).
 * Не путать с HERO_PLAQUE_HREF_DEFAULT: пустой href у сохранённой plaque → /catalog.
 */
export const HERO_PLAQUE_TEMPLATE_SEED_HREF =
  '/catalog/aroma/teplichka-u-babuli'

/**
 * Перенос заголовка плашки: только при ровно одной точке-предложении.
 * 0 или 2+ точек → одна строка (без странного UI).
 */
export function heroPlaqueTitleLines(title: string): [string] | [string, string] {
  const t = title.trim()
  if (!t) return ['']
  const first = t.indexOf('.')
  if (first < 0) return [t]
  if (t.indexOf('.', first + 1) >= 0) return [t]
  const a = t.slice(0, first).trim()
  const b = t.slice(first + 1).trim()
  if (!a || !b) return [t]
  return [a, b]
}

/** Плашка валидна только целиком (title + subtitle + imageUrl). */
export function normalizeHeroPlaque(
  input: Partial<HeroPlaque> | null | undefined,
  hrefFallback = HERO_PLAQUE_HREF_DEFAULT,
): HeroPlaque | null {
  if (!input) return null
  const title = (input.title ?? '').trim()
  const subtitle = (input.subtitle ?? '').trim()
  const imageUrl = (input.imageUrl ?? '').trim()
  if (!title || !subtitle || !imageUrl) return null
  return {
    title,
    subtitle,
    imageUrl,
    href: (input.href ?? '').trim() || hrefFallback,
  }
}

/**
 * Если плашка включена (объект), все обязательные поля должны быть заполнены.
 * Частично заполненная плашка → ошибка (не silent null).
 */
export function assertHeroPlaqueComplete(
  plaque: Partial<HeroPlaque> | null | undefined,
  label = 'Плашка',
): HeroPlaque | null {
  if (plaque == null) return null
  const title = (plaque.title ?? '').trim()
  const subtitle = (plaque.subtitle ?? '').trim()
  const imageUrl = (plaque.imageUrl ?? '').trim()
  const any = Boolean(title || subtitle || imageUrl || (plaque.href ?? '').trim())
  if (!any) return null
  if (!title || !subtitle || !imageUrl) {
    throw new Error(
      `${label}: нужны заголовок, подзаголовок и обложка — или выключите плашку`,
    )
  }
  return {
    title,
    subtitle,
    imageUrl,
    href: (plaque.href ?? '').trim() || HERO_PLAQUE_HREF_DEFAULT,
  }
}

/** Flat DB-колонки → каноническая plaque (для Nest serialize). DB пока badge*. */
export function plaqueFromFlatColumns(row: {
  badgeTitle?: string | null
  badgeSubtitle?: string | null
  badgeImageUrl?: string | null
  badgeHref?: string | null
}): HeroPlaque | null {
  return normalizeHeroPlaque({
    title: row.badgeTitle ?? '',
    subtitle: row.badgeSubtitle ?? '',
    imageUrl: row.badgeImageUrl ?? '',
    href: row.badgeHref ?? '',
  })
}

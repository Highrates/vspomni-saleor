/** Коллекция блока «Выбор ⭐» на витрине (Admin + Front). */
export const CHOICE_COLLECTION_SLUG = 'vybor'

/** Сколько карточек «Выбор» тянуть на SSR (карусель ~3–4 вьюпорта). */
export const CHOICE_CAROUSEL_LIMIT = 12

/** Сетка «носовые сосочки» на главной. */
export const NOSE_HOME_LIMIT = 12

/** Карточки «Популярное» на главной. */
export const POPULAR_HOME_LIMIT = 4

/** Популярное (диффузоры) на главной. */
export const POPULAR_COLLECTION_SLUG = 'populiarnye'

/** «Кое-что новое для вас». */
export const NEW_COLLECTION_SLUG = 'koe-chto-novoe-dlia-vas'

const CHOICE_STAR_MONTHS_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const

/**
 * Дата звезды для карточки «Выбор ⭐» (`choiceStarDate`).
 * YYYY-MM-DD (и ISO с T…) — по календарным компонентам, без сдвига TZ.
 */
export function formatChoiceStarDate(
  dateString: string | null | undefined,
): string {
  if (!dateString) return ''
  const raw = dateString.trim()
  if (!raw) return ''

  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (ymd) {
    const year = Number(ymd[1])
    const month = Number(ymd[2])
    const day = Number(ymd[3])
    const monthName = CHOICE_STAR_MONTHS_RU[month - 1]
    if (!monthName || day < 1 || day > 31) return ''
    return `${day} ${monthName} ${year}`
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()
  const monthName = CHOICE_STAR_MONTHS_RU[month]
  if (!monthName) return ''
  return `${day} ${monthName} ${year}`
}

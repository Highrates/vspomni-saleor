/**
 * geo_id для POST .../platform/pickup-points/list — иначе приходит весь РФ (очень долго).
 * @see https://yandex.ru/support/delivery-profile/ru/api/other-day/ref/2.-Tochki-samoprivoza-i-PVZ/apib2bplatformpickup-pointslist-post
 */

/** Каноническое отображаемое имя → geo_id */
export const YANDEX_CITY_GEO_ID: Record<string, number> = {
  Москва: 213,
  'Санкт-Петербург': 2,
  Новосибирск: 65,
  Екатеринбург: 54,
  Казань: 43,
  'Нижний Новгород': 47,
  Челябинск: 56,
  Самара: 51,
  Омск: 66,
  'Ростов-на-Дону': 39,
  Уфа: 172,
  Красноярск: 62,
  Воронеж: 193,
  Пермь: 50,
  Волгоград: 38,
  Краснодар: 35,
  Саратов: 194,
  Тюмень: 55,
  Тольятти: 240,
  Ижевск: 44,
  Барнаул: 197,
  Иркутск: 63,
  Ульяновск: 195,
  Хабаровск: 76,
  Ярославль: 16,
  Владивосток: 75,
  Махачкала: 28,
  Томск: 67,
  Оренбург: 48,
  Кемерово: 64,
  Новокузнецк: 237,
  Рязань: 11,
  Астрахань: 37,
  Пенза: 49,
  Липецк: 9,
  Киров: 46,
  Чебоксары: 45,
  Калининград: 22,
  Тула: 15,
  Сочи: 239,
  Курск: 8,
  Ставрополь: 12,
  Тверь: 14,
  Магнитогорск: 235,
  Иваново: 5,
  Брянск: 191,
  Белгород: 4,
  Сургут: 973,
  Владимир: 192,
  Архангельск: 20,
  Чита: 68,
  Смоленск: 10,
  Калуга: 6,
  Саранск: 42,
  'Набережные Челны': 372,
}

const PRIORITY_CITIES_FIRST = ['Москва', 'Санкт-Петербург'] as const

function normalizeCityKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
}

/** Синонимы (нормализованные) → ключ из YANDEX_CITY_GEO_ID */
const ALIAS_TO_CANONICAL: Record<string, keyof typeof YANDEX_CITY_GEO_ID> = {
  спб: 'Санкт-Петербург',
  питер: 'Санкт-Петербург',
  'с-пб': 'Санкт-Петербург',
  'st petersburg': 'Санкт-Петербург',
  'saint petersburg': 'Санкт-Петербург',
}

/** Города для выпадающего списка: Москва, СПб, далее по алфавиту */
export function orderedYandexPvzCityNames(): string[] {
  const all = Object.keys(YANDEX_CITY_GEO_ID)
  const priSet = new Set<string>(PRIORITY_CITIES_FIRST)
  const pri = PRIORITY_CITIES_FIRST.filter((p) => all.includes(p))
  const rest = all.filter((c) => !priSet.has(c)).sort((a, b) => a.localeCompare(b, 'ru'))
  return [...pri, ...rest]
}

export function resolveYandexGeoId(cityName: string): number | undefined {
  if (!cityName?.trim()) return undefined
  const norm = normalizeCityKey(cityName)
  const viaAlias = ALIAS_TO_CANONICAL[norm]
  if (viaAlias) return YANDEX_CITY_GEO_ID[viaAlias]

  const found = Object.entries(YANDEX_CITY_GEO_ID).find(
    ([displayName]) => normalizeCityKey(displayName) === norm,
  )
  return found ? found[1] : undefined
}

/** Подпись города из справочника для UI и запроса ПВЗ; неизвестный город → Москва */
export function catalogDisplayCityForUserCity(userCity: string): string {
  const id = resolveYandexGeoId(userCity)
  if (id == null) return 'Москва'
  const pair = Object.entries(YANDEX_CITY_GEO_ID).find(([, g]) => g === id)
  return pair ? pair[0] : 'Москва'
}

import type { CdekCity } from '@/lib/shipping/types'

/** Минимальный адрес для выбора города СДЭК. */
export type CdekAddressPickInput = {
  city: string
  countryArea?: string | null
  cityArea?: string | null
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '')
}

/** Убираем хвосты вроде «область», «край» для грубого сравнения регионов */
function regionTokens(s: string): string[] {
  const n = norm(s)
    .replace(/\bобласть\b/g, '')
    .replace(/\bобл\.?\b/g, '')
    .replace(/\bкрай\b/g, '')
    .replace(/\bреспублика\b/g, '')
    .replace(/\bавтономный округ\b/g, '')
    .trim()
  return n.split(/[\s,]+/).filter(Boolean)
}

function regionRoughMatch(addressRegion: string, cdekRegion: string): boolean {
  const a = norm(addressRegion)
  const b = norm(cdekRegion)
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  const ta = regionTokens(addressRegion)
  const tb = regionTokens(cdekRegion)
  for (const x of ta) {
    if (x.length < 3) continue
    for (const y of tb) {
      if (y.length < 3) continue
      if (x === y || x.includes(y) || y.includes(x)) return true
    }
  }
  return false
}

function scoreCity(addr: CdekAddressPickInput, c: CdekCity): number {
  let s = 0
  const ac = norm(addr.city)
  const cc = norm(c.city)
  if (ac && cc && ac === cc) s += 80
  else if (ac && cc && (cc.includes(ac) || ac.includes(cc))) s += 50

  if (addr.countryArea?.trim() && c.region) {
    if (regionRoughMatch(addr.countryArea, c.region)) s += 100
  }

  const area = norm(addr.cityArea || '')
  const sub = c.sub_region ? norm(c.sub_region) : ''
  if (area && sub && (area === sub || sub.includes(area) || area.includes(sub))) {
    s += 40
  }

  return s
}

/**
 * Выбор города СДЭК по адресу (город, регион, район).
 * При равном счёте — стабильный порядок по коду.
 */
export function pickCdekCityForAddress(
  addr: CdekAddressPickInput,
  cities: CdekCity[],
): CdekCity | null {
  if (!cities?.length) return null
  if (cities.length === 1) return cities[0]

  const ranked = cities.map((c) => ({ c, score: scoreCity(addr, c) }))
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.c.code - b.c.code
  })

  const best = ranked[0]
  if (best.score > 0) return best.c

  const ac = norm(addr.city)
  const exact = cities.find((c) => norm(c.city) === ac)
  if (exact) return exact

  return cities[0]
}

export function cleanRuPostalCode(code: string | undefined | null): string | undefined {
  if (!code?.trim()) return undefined
  const digits = code.replace(/\D/g, '')
  if (digits.length === 6) return digits
  return undefined
}

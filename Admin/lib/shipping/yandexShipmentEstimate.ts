/**
 * Оценка веса и габаритов для Яндекс Cargo / Platform pricing-calculator.
 * Товары без веса/размеров — консервативные дефолты (как «типичный флакон»).
 */

export type YandexShipmentLineInput = {
  quantity: number
  weightKg?: number
  lengthMm?: number
  widthMm?: number
  heightMm?: number
}

const DEFAULT_UNIT_G = 200
const DEFAULT_MM = { l: 80, w: 55, h: 45 }
const MIN_SIDE_CM = 8
const MAX_SIDE_CM = 150
const MIN_TOTAL_G = 100
const MAX_TOTAL_G = 50_000
/** Макс. одна сторона «стопки» одинаковых коробок, мм (защита от нереалистичных башен) */
const MAX_STACKED_EDGE_MM = 1200

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * Одна SKU: стопка qty штук вдоль самого короткого ребра (типичная укладка).
 * Возвращает три стороны параллелепипеда в мм (не отсортированы).
 */
function stackedBoxMm(
  lengthMm: number,
  widthMm: number,
  heightMm: number,
  qty: number,
): [number, number, number] {
  const q = Math.max(1, Math.floor(qty))
  const [a, b, c] = [lengthMm, widthMm, heightMm].sort((x, y) => x - y)
  const stackedShort = Math.min(a * q, MAX_STACKED_EDGE_MM)
  return [stackedShort, b, c]
}

/** Суммарный вес (г) и одно место (см) из линий корзины */
export function estimateYandexShipmentPackage(
  lines: YandexShipmentLineInput[],
): { totalWeightG: number; dxCm: number; dyCm: number; dzCm: number } {
  const valid = lines.filter((l) => l.quantity > 0)
  if (valid.length === 0) {
    return {
      totalWeightG: 2000,
      dxCm: 30,
      dyCm: 20,
      dzCm: 20,
    }
  }

  let totalWeightG = 0
  let totalVolMm3 = 0

  for (const line of valid) {
    const q = Math.floor(line.quantity)
    const wKg =
      line.weightKg != null && line.weightKg > 0 ? line.weightKg : undefined
    const g = wKg != null ? Math.round(wKg * 1000 * q) : DEFAULT_UNIT_G * q
    totalWeightG += g

    const l =
      line.lengthMm != null && line.lengthMm > 0
        ? line.lengthMm
        : DEFAULT_MM.l
    const w =
      line.widthMm != null && line.widthMm > 0 ? line.widthMm : DEFAULT_MM.w
    const h =
      line.heightMm != null && line.heightMm > 0 ? line.heightMm : DEFAULT_MM.h
    totalVolMm3 += l * w * h * q
  }

  totalWeightG = clamp(totalWeightG, MIN_TOTAL_G, MAX_TOTAL_G)

  // Одна позиция в корзине: явная стопка (не «куб из ∛объёма», который маскирует длину)
  if (valid.length === 1) {
    const line = valid[0]
    const q = Math.max(1, Math.floor(line.quantity))
    const l =
      line.lengthMm != null && line.lengthMm > 0
        ? line.lengthMm
        : DEFAULT_MM.l
    const w =
      line.widthMm != null && line.widthMm > 0 ? line.widthMm : DEFAULT_MM.w
    const h =
      line.heightMm != null && line.heightMm > 0 ? line.heightMm : DEFAULT_MM.h
    const edgesMm = stackedBoxMm(l, w, h, q)
    const [d0, d1, d2] = [...edgesMm].sort((x, y) => x - y)
    const toCm = (mm: number) => Math.round((mm / 10) * 10) / 10
    return {
      totalWeightG,
      dxCm: toCm(d2),
      dyCm: toCm(d1),
      dzCm: toCm(d0),
    }
  }

  const volCm3 = Math.max(1, totalVolMm3 / 1000)
  const side = Math.cbrt(volCm3)
  const base = clamp(side, MIN_SIDE_CM, MAX_SIDE_CM)
  const dxCm = clamp(base * 1.12, MIN_SIDE_CM, MAX_SIDE_CM)
  const dyCm = clamp(base * 0.98, MIN_SIDE_CM, MAX_SIDE_CM)
  const dzCm = clamp(base * 0.9, MIN_SIDE_CM, MAX_SIDE_CM)

  return {
    totalWeightG,
    dxCm: Math.round(dxCm * 10) / 10,
    dyCm: Math.round(dyCm * 10) / 10,
    dzCm: Math.round(dzCm * 10) / 10,
  }
}

/** Тело POST /api/yandex-delivery (calculate): явная посылка или линии корзины */
export type YandexShipmentRequestBody = {
  shipment?: {
    total_weight_g?: number
    length_cm?: number
    width_cm?: number
    height_cm?: number
  }
  shipment_lines?: Array<{
    quantity?: number
    weight_kg?: number
    length_mm?: number
    width_mm?: number
    height_mm?: number
  }>
}

/**
 * В ЛК «ПВЗ → ПВЗ» (NDD) верхняя доступная ячейка габаритов часто 32×25×15 см
 * (любая ориентация посылки). Запросы с большим боксом дают более дорогой тариф.
 */
const NDD_PVZ_MAX_CM_ASC = [15, 25, 32] as const

/**
 * Platform pricing-calculator / PlacePhysicalDimensions (док 1.01):
 * dx — длина, dy — высота, dz — ширина (см, целые).
 * Три стороны короба без привязки к осям → сортируем: мин = «высота» (тонкая грань),
 * макс = «длина», средняя = «ширина». Объём dx·dy·dz не меняется.
 * @see https://yandex.com/support/delivery-profile/ru/api/other-day/ref/1.-Podgotovka-zayavki/apib2bplatformpricing-calculator-post
 */
export function toYandexPricingCalculatorDimsCm(
  sideACm: number,
  sideBCm: number,
  sideCCm: number,
): { dx: number; dy: number; dz: number } {
  const [a, b, c] = [sideACm, sideBCm, sideCCm]
    .map((n) => Math.max(1, Math.round(Number(n) || 1)))
    .sort((x, y) => x - y)
  return {
    dy: a,
    dz: b,
    dx: c,
  }
}

/**
 * Уменьшает dx/dy/dz с сохранением пропорций, пока короб не помещается в лимит ЛК.
 * Вес не трогаем — в ЛК выбирается отдельно.
 */
export function capYandexNddPvzPackageDims(pkg: {
  totalWeightG: number
  dxCm: number
  dyCm: number
  dzCm: number
}): { totalWeightG: number; dxCm: number; dyCm: number; dzCm: number } {
  const maxAsc = NDD_PVZ_MAX_CM_ASC
  const sidesAsc = [pkg.dxCm, pkg.dyCm, pkg.dzCm].sort((a, b) => a - b)
  if (
    sidesAsc[0] <= maxAsc[0] &&
    sidesAsc[1] <= maxAsc[1] &&
    sidesAsc[2] <= maxAsc[2]
  ) {
    return pkg
  }
  const scale = Math.min(
    maxAsc[0] / sidesAsc[0],
    maxAsc[1] / sidesAsc[1],
    maxAsc[2] / sidesAsc[2],
  )
  const round1 = (n: number) => Math.round(n * 10) / 10
  return {
    totalWeightG: pkg.totalWeightG,
    dxCm: round1(pkg.dxCm * scale),
    dyCm: round1(pkg.dyCm * scale),
    dzCm: round1(pkg.dzCm * scale),
  }
}

export function resolveYandexShipmentPackage(
  body: YandexShipmentRequestBody,
): { totalWeightG: number; dxCm: number; dyCm: number; dzCm: number } {
  const s = body.shipment
  if (
    s &&
    typeof s.total_weight_g === 'number' &&
    Number.isFinite(s.total_weight_g) &&
    s.total_weight_g > 0 &&
    typeof s.length_cm === 'number' &&
    Number.isFinite(s.length_cm) &&
    s.length_cm > 0 &&
    typeof s.width_cm === 'number' &&
    Number.isFinite(s.width_cm) &&
    s.width_cm > 0 &&
    typeof s.height_cm === 'number' &&
    Number.isFinite(s.height_cm) &&
    s.height_cm > 0
  ) {
    return {
      totalWeightG: clamp(Math.round(s.total_weight_g), MIN_TOTAL_G, MAX_TOTAL_G),
      dxCm: clamp(s.length_cm, MIN_SIDE_CM, MAX_SIDE_CM),
      dyCm: clamp(s.width_cm, MIN_SIDE_CM, MAX_SIDE_CM),
      dzCm: clamp(s.height_cm, MIN_SIDE_CM, MAX_SIDE_CM),
    }
  }

  const lines = body.shipment_lines
  if (Array.isArray(lines) && lines.length > 0) {
    return estimateYandexShipmentPackage(
      lines.map((r) => ({
        quantity: Math.max(0, Math.floor(Number(r.quantity) || 0)),
        weightKg: r.weight_kg,
        lengthMm: r.length_mm,
        widthMm: r.width_mm,
        heightMm: r.height_mm,
      })),
    )
  }

  return estimateYandexShipmentPackage([])
}

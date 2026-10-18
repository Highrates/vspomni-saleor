import type { YandexPickupPoint } from '@/lib/shipping/types'

const HYPHENATED_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isHyphenatedUuidPointId(s: string): boolean {
  return HYPHENATED_UUID_RE.test(s.trim())
}

/**
 * ID пункта для Platform pricing-calculator `destination.platform_station_id`:
 * UUID с дефисами или 24–32 hex (ULID / id из pickup-points/list).
 * Числовой `operator_station_id` (например 10030280672) сюда не подходит — в calculator передавать `destination.address`.
 */
export function isLikelyYandexPlatformStationId(s: string): boolean {
  const t = s.trim()
  if (HYPHENATED_UUID_RE.test(t)) return true
  return /^[0-9a-f]{24,32}$/i.test(t)
}

/** 32 hex без дефисов: может быть и platform id Яндекса, и компактный UUID v4 */
function isCompactUuidV4(s: string): boolean {
  if (!/^[0-9a-f]{32}$/i.test(s)) return false
  const n = parseInt(s[12], 16)
  return Number.isFinite(n) && (n & 0xf) === 4
}

function operatorId(pvz: YandexPickupPoint): string {
  return (pvz.operator_station_id || pvz.operatorStationId || '').trim()
}

/**
 * Идентификатор для Cargo offers/calculate: route_points[].point_id + type=pvz.
 * Док: поле `id` из pickup-points/list (обычно длинная hex без дефисов).
 * Если `id` — UUID, в расчёт часто нужен `operator_station_id` (см. ответ list).
 */
export function yandexPointIdForCargoOffers(pvz: YandexPickupPoint): string {
  const id = (pvz.id || '').trim()
  const op = operatorId(pvz)

  if (HYPHENATED_UUID_RE.test(id) && op) {
    return op
  }
  if (isCompactUuidV4(id) && op) {
    return op
  }
  return id || op
}

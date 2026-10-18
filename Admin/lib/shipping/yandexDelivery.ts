import type {
  YandexCalculateResponse,
  YandexCalculatedOffer,
  YandexPickupPointsResponse,
  YandexPickupPoint,
} from '@/lib/shipping/types'

const API_BASE = '/api/yandex-delivery'

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = (data as { error?: string }).error || res.statusText
    throw new Error(msg)
  }
  return data as T
}

/** Рассчитать стоимость доставки Яндекса
 *  Используется как для доставки «до двери», так и для доставки до ПВЗ.
 *  Если передать coordinates, то сервер возьмёт их напрямую и не будет геокодировать адрес.
 *  Параметр mode позволяет подсказать бэкенду тип доставки (door | pvz).
 */
export type YandexCalculateShipmentLine = {
  quantity: number
  weightKg?: number
  lengthMm?: number
  widthMm?: number
  heightMm?: number
}

export async function calculateDelivery(params: {
  city: string
  street?: string
  building?: string
  fullname?: string
  coordinates?: [number, number] // [долгота, широта]
  mode?: 'door' | 'pvz'
  /** id пункта из списка ПВЗ Яндекса — для mode=pvz в API */
  yandexPointId?: string
  /** Линии корзины — вес/габариты в Cargo и Platform pricing-calculator */
  shipmentLines?: YandexCalculateShipmentLine[]
}): Promise<YandexCalculateResponse> {
  return post<YandexCalculateResponse>({
    action: 'calculate',
    mode: params.mode,
    to: {
      city: params.city,
      street: params.street,
      building: params.building,
      fullname: params.fullname,
      coordinates: params.coordinates,
      ...(params.yandexPointId?.trim()
        ? { yandex_point_id: params.yandexPointId.trim() }
        : {}),
    },
    ...(params.shipmentLines?.length
      ? {
          shipment_lines: params.shipmentLines.map((l) => ({
            quantity: l.quantity,
            ...(l.weightKg != null ? { weight_kg: l.weightKg } : {}),
            ...(l.lengthMm != null ? { length_mm: l.lengthMm } : {}),
            ...(l.widthMm != null ? { width_mm: l.widthMm } : {}),
            ...(l.heightMm != null ? { height_mm: l.heightMm } : {}),
          })),
        }
      : {}),
  })
}

/** Парсинг цены из ответа Яндекса (в т.ч. с запятой как десятичным разделителем) */
export function parseYandexOfferPrice(raw: string | undefined): number {
  if (raw == null || raw === '') return 0
  const normalized = String(raw).replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : 0
}

/** Получить самый дешёвый оффер из ответа расчёта */
export function getCheapestOffer(offers: YandexCalculatedOffer[]): YandexCalculatedOffer | null {
  if (!offers?.length) return null
  return offers.reduce((min, o) => {
    const price = parseYandexOfferPrice(o.price?.total_price)
    const minPrice = parseYandexOfferPrice(min.price?.total_price)
    return price < minPrice ? o : min
  })
}

/** Список ПВЗ Яндекса (пункты выдачи и постаматы). Опционально: geo_id, type. */
export async function getPickupPoints(params?: {
  geo_id?: number
  type?: 'pickup_point' | 'terminal' | 'warehouse'
}): Promise<YandexPickupPointsResponse> {
  return post<YandexPickupPointsResponse>({
    action: 'list-pickup-points',
    ...params,
  })
}

/** Склады платформы NDD — в ответе у каждого склада `station_id` для YANDEX_PLATFORM_SOURCE_STATION_ID */
export async function getYandexWarehousesList(params?: {
  merchant_id?: string
}): Promise<{ warehouses?: unknown[] }> {
  return post<{ warehouses?: unknown[] }>({
    action: 'warehouses-list',
    ...(params?.merchant_id?.trim()
      ? { merchant_id: params.merchant_id.trim() }
      : {}),
  })
}

export type { YandexPickupPoint }

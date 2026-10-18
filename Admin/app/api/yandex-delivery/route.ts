import { NextRequest, NextResponse } from 'next/server'
import {
  isHyphenatedUuidPointId,
  isLikelyYandexPlatformStationId,
} from '@/lib/shipping/yandexPickupPointId'
import {
  capYandexNddPvzPackageDims,
  resolveYandexShipmentPackage,
  toYandexPricingCalculatorDimsCm,
} from '@/lib/shipping/yandexShipmentEstimate'

const YANDEX_API_BASE = 'https://b2b.taxi.yandex.net'
const YANDEX_PLATFORM_API_BASE = process.env.YANDEX_DELIVERY_PLATFORM_URL || 'https://b2b-authproxy.taxi.yandex.net'
const CARGO_PATH = '/b2b/cargo/integration/v2'
const PLATFORM_PICKUP_LIST_PATH = '/api/b2b/platform/pickup-points/list'
const PLATFORM_PRICING_CALCULATOR_PATH = '/api/b2b/platform/pricing-calculator'
const PLATFORM_WAREHOUSES_LIST_PATH = '/api/b2b/platform/warehouses/list'

/** Запятая после города: «Россия, Москва улица …» → «Россия, Москва, улица …» (рекомендации Яндекса по полному адресу). */
function normalizeRuAddressForYandex(fullname: string): string {
  const s = fullname.trim()
  return s
    .replace(/^Россия,\s*Москва\s+(?!,)/i, 'Россия, Москва, ')
    .replace(/^Россия,\s*Санкт-Петербург\s+(?!,)/i, 'Россия, Санкт-Петербург, ')
}

/** Для Platform pricing-calculator в примерах доки адрес без префикса «Россия,». */
function addressForPlatformPricing(full: string): string {
  return full.replace(/^Россия,\s*/i, '').trim() || full.trim()
}

/**
 * Парсинг pricing_total из pricing-calculator (пример из доки: "225.7 RUB" — рубли с десятыми).
 * @see https://yandex.com/support/delivery-profile/ru/api/other-day/ref/1.-Podgotovka-zayavki/apib2bplatformpricing-calculator-post
 */
function parsePricingTotalRub(s: string | undefined): number {
  if (!s || typeof s !== 'string') return NaN
  const m = s.replace(/\s/g, '').match(/^([\d.,]+)/)
  if (!m) return NaN
  return parseFloat(m[1].replace(',', '.'))
}

function getToken(): string {
  const token = process.env.YANDEX_DELIVERY_TOKEN
  if (!token?.trim()) {
    throw new Error('YANDEX_DELIVERY_TOKEN is not set')
  }
  return token.trim()
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

/** Из ответа API Яндекса достаём текст ошибки для пользователя (доставка) */
function yandexErrorToMessage(resStatus: number, err: Record<string, unknown>): string {
  const raw =
    typeof err.error === 'string'
      ? err.error
      : typeof err.message === 'string'
        ? err.message
        : typeof err.code === 'string'
          ? err.code
          : typeof err.description === 'string'
            ? err.description
            : ''
  const lower = raw.toLowerCase()
  // Ответ API: "Метод оплаты не доступен" — в ЛК доставки Яндекса не подключена оплата для B2B такси
  if (lower.includes('метод оплаты') || lower.includes('payment') && lower.includes('method')) {
    return 'В личном кабинете доставки Яндекса (dostavka.yandex.ru) подключите способ оплаты для B2B такси: Настройки → Оплата / привязка счёта.'
  }
  if (resStatus === 401 || resStatus === 403 || lower.includes('access denied') || lower.includes('forbidden') || lower.includes('unauthorized')) {
    return 'Доступ к API доставки Яндекса запрещён. Проверьте YANDEX_DELIVERY_TOKEN: токен должен быть из личного кабинета dostavka.yandex.ru (B2B такси), не OAuth.'
  }
  if (resStatus === 404 || lower.includes('not found')) {
    return 'Сервис расчёта доставки не найден. Проверьте подключение B2B такси в dostavka.yandex.ru.'
  }
  if (lower.includes('invalid') && lower.includes('token')) {
    return 'Неверный токен доставки Яндекса. Укажите корректный YANDEX_DELIVERY_TOKEN из dostavka.yandex.ru.'
  }
  if (raw) return raw
  if (resStatus === 502 || resStatus === 503) return 'Сервис доставки Яндекса временно недоступен. Попробуйте позже.'
  return 'Ошибка расчёта доставки Яндекса. Попробуйте позже или измените адрес.'
}

/** Ошибки Platform API (NDD): не подменяем 404 текстом про «B2B такси» — это другой контур. */
function yandexPlatformErrorToMessage(
  resStatus: number,
  err: Record<string, unknown>,
  responseText: string,
): string {
  const raw =
    typeof err.message === 'string'
      ? err.message
      : typeof err.error === 'string'
        ? err.error
        : typeof err.code === 'string'
          ? err.code
          : ''
  if (/merchant not found/i.test(raw)) {
    return (
      'Яндекс: Merchant not found — значение в YANDEX_PLATFORM_MERCHANT_ID не является merchant_id в API «доставка в другой день». ' +
      'ID клиента в ЛК часто другой идентификатор. Запросите у поддержки Яндекса поле merchant_id для POST .../platform/warehouses/list.'
    )
  }
  if (/source station is invalid/i.test(raw)) {
    return (
      'Platform API: source.platform_station_id не принят (склад не найден в платформе). ' +
      'Укажите station_id из ответа POST .../platform/warehouses/list для вашего склада, либо совпадающий с point_id отправления в Cargo (YANDEX_DELIVERY_WAREHOUSE_ID). ' +
      raw
    )
  }
  if (raw && !/^parse error/i.test(raw)) return raw
  if (resStatus === 400) {
    return (
      'Platform API: неверный запрос (400). Проверьте filter.merchant_id и тело запроса. ' +
      (responseText || '').slice(0, 500)
    )
  }
  if (resStatus === 404) {
    return (
      'Platform API (доставка в другой день): метод недоступен или не найден (404). ' +
      'Часто у токена нет доступа к API складов/мерчанта, либо неверный merchant_id, либо склад не создан в платформе. ' +
      'Уточните в поддержке Яндекса доступ к POST .../platform/warehouses/list. Ответ: ' +
      (responseText || '').slice(0, 400)
    )
  }
  if (resStatus === 401 || resStatus === 403) {
    return 'Доступ к Platform API запрещён. Проверьте токен в dostavka.yandex.ru → Интеграция.'
  }
  return raw || responseText.slice(0, 300) || `Platform API HTTP ${resStatus}`
}

/** Запрос к B2B Platform API (ПВЗ и т.д.) — другой хост */
async function yandexPlatformRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getToken()
  const url = `${YANDEX_PLATFORM_API_BASE}${path}`
  const res = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'ru',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) {
    let err: Record<string, unknown>
    try {
      err = JSON.parse(text) as Record<string, unknown>
    } catch {
      err = { message: text || res.statusText }
    }
    console.error('Yandex Platform API raw error:', res.status, path, text)
    const userMsg = yandexPlatformErrorToMessage(res.status, err, text)
    throw new Error(userMsg)
  }
  return text ? (JSON.parse(text) as T) : ({} as T)
}

async function yandexRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getToken()
  const url = `${YANDEX_API_BASE}${path}`
  const res = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'ru',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) {
    let err: Record<string, unknown>
    try {
      err = JSON.parse(text) as Record<string, unknown>
    } catch {
      err = { message: text || res.statusText }
    }
    console.error('Yandex Delivery API raw error:', res.status, text)
    const userMsg = yandexErrorToMessage(res.status, err)
    throw new Error(userMsg)
  }
  return text ? (JSON.parse(text) as T) : ({} as T)
}

// Геокодирование адреса через Nominatim (бесплатно)
async function geocodeAddress(fullname: string): Promise<[number, number] | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', fullname)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'JcosStore/1.0' },
    })
    const data = await res.json()
    if (Array.isArray(data) && data[0]) {
      const lon = parseFloat(data[0].lon)
      const lat = parseFloat(data[0].lat)
      if (Number.isFinite(lon) && Number.isFinite(lat)) return [lon, lat]
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Точка отправления (ПВЗ/склад в ЛК Яндекса).
 * Для сценария ПВЗ→ПВЗ в offers/calculate у точки id:1 должен быть point_id из pickup-points/list.
 */
/**
 * Дефолтный ПВЗ/склад СПб (Ватутина). Поддержка Яндекса: старый пункт мог закрыться —
 * обновите YANDEX_DELIVERY_WAREHOUSE_ID + координаты из актуального pickup-points/list.
 */
const DEFAULT_SPB_WAREHOUSE_POINT_ID = '019c55f8c0d972ea9b59302a85430825'

/** Полный адрес (страна, город, улица, дом) — иначе Cargo может вернуть пустой offers (ответ поддержки). */
const DEFAULT_SPB_WAREHOUSE_ADDRESS =
  'Россия, Санкт-Петербург, улица Ватутина, дом 8/7Д'

function getWarehousePoint(): { coordinates?: [number, number]; fullname: string; point_id?: string } {
  const lat = process.env.YANDEX_DELIVERY_WAREHOUSE_LAT
  const lng = process.env.YANDEX_DELIVERY_WAREHOUSE_LNG
  const fullname =
    process.env.YANDEX_DELIVERY_WAREHOUSE_FULLNAME?.trim() ||
    DEFAULT_SPB_WAREHOUSE_ADDRESS
  const envId = process.env.YANDEX_DELIVERY_WAREHOUSE_ID?.trim()
  const warehousePointId = envId || DEFAULT_SPB_WAREHOUSE_POINT_ID

  if (lat && lng) {
    const lon = parseFloat(lng)
    const latN = parseFloat(lat)
    if (Number.isFinite(lon) && Number.isFinite(latN)) {
      return {
        coordinates: [lon, latN],
        fullname,
        point_id: warehousePointId,
      }
    }
  }
  return {
    coordinates: [30.379738, 59.962021],
    fullname: DEFAULT_SPB_WAREHOUSE_ADDRESS,
    point_id: warehousePointId,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('--- Yandex Delivery API Request ---', JSON.stringify(body, null, 2))
    const action = body.action as string

    if (action === 'calculate') {
      const { to, mode } = body as {
        to: {
          city: string
          street?: string
          building?: string
          fullname?: string
          coordinates?: [number, number]
          /** id пункта из pickup-points/list — иначе нельзя вешать type=pvz на точку */
          yandex_point_id?: string
          yandexPointId?: string
        }
        mode?: 'door' | 'pvz'
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
      const pkgResolved = resolveYandexShipmentPackage(body)
      const yandexDropoffPointId = (
        to.yandex_point_id ||
        to.yandexPointId ||
        ''
      ).trim()
      const fullname =
        to.fullname ||
        [to.city, to.street, to.building].filter(Boolean).join(', ')

      const cityInput = to.city || ''
      const cityNorm = cityInput
        .trim()
        .replace(/^(МОСКВА|Москва).*$/i, 'Москва')
        .replace(/^(САНКТ-ПЕТЕРБУРГ|Санкт-Петербург).*$/i, 'Санкт-Петербург')

      let fullnameForGeocode =
        fullname
          .replace(/\s*,\s*/g, ', ')
          .replace(/^МОСКВА\b/i, 'Москва')
          .replace(/^САНКТ-ПЕТЕРБУРГ\b/i, 'Санкт-Петербург')

      console.log('--- Geocoding target ---', { fullnameForGeocode, cityNorm })

      // Если координаты уже переданы с фронта (например, для ПВЗ), используем их напрямую
      let coordinates: [number, number] | null = null
      if (Array.isArray(to.coordinates) && to.coordinates.length === 2) {
        const lon = Number(to.coordinates[0])
        const lat = Number(to.coordinates[1])
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          coordinates = [lon, lat]
        }
      }

      if (!coordinates) {
        coordinates = await geocodeAddress(fullnameForGeocode || fullname)
      }
      if (!coordinates && fullnameForGeocode && cityNorm) {
        const streetPart = (to.street || to.building || fullnameForGeocode)
          .replace(new RegExp(`^${cityNorm}\\s+`, 'i'), '')
          .trim()
        const shortAddress = streetPart ? `${cityNorm}, ${streetPart}` : cityNorm
        coordinates = await geocodeAddress(shortAddress)
      }
      if (!coordinates && fullnameForGeocode) {
        const withCountry = fullnameForGeocode.startsWith('Россия')
          ? fullnameForGeocode
          : `Россия, ${fullnameForGeocode}`
        coordinates = await geocodeAddress(withCountry)
      }
      if (!coordinates) {
        return json({
          error: 'Не удалось определить координаты адреса. Проверьте город и улицу.',
          offers: [],
        }, 200)
      }
      const warehouse = getWarehousePoint()
      const dropoffFullname =
        cityNorm && (to.street || to.building)
          ? `${cityNorm}, ${(to.street || '')
            .replace(new RegExp(`^${cityNorm}\\s+`, 'i'), '')
            .trim() || to.building}`
          : fullname
      // Поддержка Яндекса: адрес до двери/ПВЗ — полностью (страна + город + улица + дом), иначе пустой offers
      let dropoffFullnameForApi =
        dropoffFullname.trim() && !/^россия\b/i.test(dropoffFullname.trim())
          ? `Россия, ${dropoffFullname.trim()}`
          : dropoffFullname
      dropoffFullnameForApi = normalizeRuAddressForYandex(dropoffFullnameForApi)
      // type=pvz только вместе с point_id из сети Яндекса; иначе — расчёт «до двери» по координатам
      const useYandexPvzDropoff =
        mode === 'pvz' && Boolean(yandexDropoffPointId)

      const pkg = useYandexPvzDropoff
        ? capYandexNddPvzPackageDims(pkgResolved)
        : pkgResolved

      /** dx=длина, dy=высота, dz=ширина (см) — как в Platform 1.01; Cargo size в метрах */
      const physicalCm = toYandexPricingCalculatorDimsCm(
        pkg.dxCm,
        pkg.dyCm,
        pkg.dzCm,
      )
      const platformWeightG = Math.max(1, Math.round(pkg.totalWeightG))
      const { dx: platDx, dy: platDy, dz: platDz } = physicalCm

      if (useYandexPvzDropoff && isHyphenatedUuidPointId(yandexDropoffPointId)) {
        console.warn(
          '[Yandex] В запросе point_id пункта доставки в формате UUID. Для offers/calculate обычно нужен `id` из pickup-points/list (hex без дефисов) или operator_station_id. Пересохраните адрес, снова выбрав ПВЗ в модалке.',
        )
      }

      const route_points = [
        {
          id: 1,
          fullname: normalizeRuAddressForYandex(warehouse.fullname),
          coordinates: warehouse.coordinates,
          ...(warehouse.point_id ? { point_id: warehouse.point_id } : {})
        },
        {
          id: 2,
          coordinates,
          fullname: dropoffFullnameForApi,
          ...(useYandexPvzDropoff
            ? { type: 'pvz', point_id: yandexDropoffPointId }
            : {}),
        },
      ]
      const items = [
        {
          size: {
            length: physicalCm.dx / 100,
            width: physicalCm.dz / 100,
            height: physicalCm.dy / 100,
          },
          weight: Math.max(0.001, pkg.totalWeightG / 1000),
          quantity: 1,
          pickup_point: 1,
          dropoff_point: 2,
        },
      ]
      // ПВЗ→ПВЗ (NDD): только ndd + skip_door_to_door.
      // До двери: НЕ форсировать ndd/delivery_type — иначе Cargo часто отдаёт пустой offers
      // на межгороде (СПб→МСК и т.д.); сначала даём API выбрать cargo/courier/express/ndd.
      const requirements: Record<string, unknown> = useYandexPvzDropoff
        ? {
            taxi_classes: ['ndd'],
            skip_door_to_door: true,
            ndd: true,
            delivery_type: 'ndd',
          }
        : {
            taxi_classes: ['cargo', 'courier', 'express', 'ndd'],
            skip_door_to_door: false,
          }

      /**
       * «Доставка в другой день» в ЛК = Platform API, не Cargo v2.
       * POST .../api/b2b/platform/pricing-calculator, tariff: self_pickup (до ПВЗ).
       * source.platform_station_id — склад в платформе (разд. 6 доки, warehouses/list).
       */
      const platformSourceStationId =
        process.env.YANDEX_PLATFORM_SOURCE_STATION_ID?.trim()
      if (useYandexPvzDropoff && platformSourceStationId) {
        try {
          type PricingDest =
            | { platform_station_id: string }
            | { address: string }
          const destinationPrimary: PricingDest =
            isLikelyYandexPlatformStationId(yandexDropoffPointId)
              ? { platform_station_id: yandexDropoffPointId }
              : { address: dropoffFullnameForApi }

          const warehousePointId = warehouse.point_id?.trim() || ''
          const fallbackSourceId =
            warehousePointId &&
            isLikelyYandexPlatformStationId(warehousePointId) &&
            warehousePointId !== platformSourceStationId
              ? warehousePointId
              : ''

          const buildPricingBody = (
            sourceStationId: string,
            destination: PricingDest,
          ) => ({
            source: { platform_station_id: sourceStationId },
            destination,
            tariff: 'self_pickup' as const,
            total_weight: platformWeightG,
            total_assessed_price: 0,
            client_price: 0,
            payment_method: 'already_paid' as const,
            places: [
              {
                physical_dims: {
                  weight_gross: platformWeightG,
                  dx: platDx,
                  dy: platDy,
                  dz: platDz,
                },
              },
            ],
          })

          let sourceId = platformSourceStationId
          let dest: PricingDest = destinationPrimary
          let ndd: { pricing_total?: string; delivery_days?: number } | undefined
          const maxPricingAttempts = 5
          for (let attempt = 0; attempt < maxPricingAttempts; attempt++) {
            try {
              ndd = await yandexPlatformRequest<{
                pricing_total?: string
                delivery_days?: number
              }>(PLATFORM_PRICING_CALCULATOR_PATH, {
                body: buildPricingBody(sourceId, dest),
              })
              if (attempt > 0) {
                console.log(
                  '[Yandex Platform] pricing-calculator успех после ретрая',
                  { sourceId: sourceId.slice(0, 12) + '…', destKind: 'platform_station_id' in dest ? 'id' : 'address' },
                )
              }
              break
            } catch (pricingErr) {
              const msg =
                pricingErr instanceof Error
                  ? pricingErr.message
                  : String(pricingErr)
              let adjusted = false
              if (/source station is invalid/i.test(msg) && fallbackSourceId) {
                if (sourceId !== fallbackSourceId) {
                  sourceId = fallbackSourceId
                  adjusted = true
                }
              }
              if (
                !adjusted &&
                /no_station|station id for point|cant get station/i.test(
                  msg,
                ) &&
                'platform_station_id' in dest
              ) {
                dest = { address: dropoffFullnameForApi }
                adjusted = true
              }
              if (!adjusted) {
                throw pricingErr
              }
            }
          }
          if (!ndd) {
            throw new Error('Platform pricing-calculator: не удалось получить ответ')
          }
          console.log(
            '--- Yandex Platform NDD pricing-calculator (full) ---',
            JSON.stringify(ndd, null, 2),
          )
          const rub = parsePricingTotalRub(ndd.pricing_total)
          const rubCheckout = Number.isFinite(rub) ? Math.round(rub) : NaN
          if (Number.isFinite(rubCheckout) && rubCheckout > 0) {
            return json({
              offers: [
                {
                  price: {
                    total_price: String(rubCheckout),
                    total_price_with_vat: String(rubCheckout),
                    base_price: String(rubCheckout),
                    currency: 'RUB',
                  },
                  taxi_class: 'ndd_self_pickup',
                  description: 'platform/pricing-calculator',
                  payload: 'ndd-platform-pricing',
                  offer_ttl: '',
                },
              ],
              delivery_days: ndd.delivery_days,
              _pricing_source: 'yandex_platform_ndd',
            })
          }
        } catch (nddErr) {
          console.warn(
            'Platform pricing-calculator (NDD ПВЗ) не удался, переходим к Cargo offers/calculate:',
            nddErr,
          )
        }
      } else if (!useYandexPvzDropoff && platformSourceStationId) {
        /**
         * Доставка до двери (межгород): по доке 1.01 тариф `time_interval`, не Cargo offers/calculate.
         * @see https://yandex.com/support/delivery-profile/ru/api/other-day/ref/1.-Podgotovka-zayavki/apib2bplatformpricing-calculator-post
         */
        try {
          const doorAddress = addressForPlatformPricing(dropoffFullnameForApi)
          const warehousePointId = warehouse.point_id?.trim() || ''
          const fallbackSourceId =
            warehousePointId &&
            isLikelyYandexPlatformStationId(warehousePointId) &&
            warehousePointId !== platformSourceStationId
              ? warehousePointId
              : ''

          const buildDoorPricingBody = (sourceStationId: string) => ({
            source: { platform_station_id: sourceStationId },
            destination: { address: doorAddress },
            tariff: 'time_interval' as const,
            total_weight: platformWeightG,
            total_assessed_price: 0,
            client_price: 0,
            payment_method: 'already_paid' as const,
            places: [
              {
                physical_dims: {
                  weight_gross: platformWeightG,
                  dx: platDx,
                  dy: platDy,
                  dz: platDz,
                },
              },
            ],
          })

          let sourceId = platformSourceStationId
          let doorPricing: { pricing_total?: string; delivery_days?: number } | undefined
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              doorPricing = await yandexPlatformRequest<{
                pricing_total?: string
                delivery_days?: number
              }>(PLATFORM_PRICING_CALCULATOR_PATH, {
                body: buildDoorPricingBody(sourceId),
              })
              break
            } catch (pricingErr) {
              const msg =
                pricingErr instanceof Error
                  ? pricingErr.message
                  : String(pricingErr)
              if (/source station is invalid/i.test(msg) && fallbackSourceId && sourceId !== fallbackSourceId) {
                sourceId = fallbackSourceId
                continue
              }
              throw pricingErr
            }
          }
          if (doorPricing) {
            console.log(
              '--- Yandex Platform door pricing-calculator (time_interval) ---',
              JSON.stringify(doorPricing, null, 2),
            )
            const rub = parsePricingTotalRub(doorPricing.pricing_total)
            const rubCheckout = Number.isFinite(rub) ? Math.round(rub) : NaN
            if (Number.isFinite(rubCheckout) && rubCheckout > 0) {
              return json({
                offers: [
                  {
                    price: {
                      total_price: String(rubCheckout),
                      total_price_with_vat: String(rubCheckout),
                      base_price: String(rubCheckout),
                      currency: 'RUB',
                    },
                    taxi_class: 'platform_time_interval',
                    description: 'platform/pricing-calculator (door)',
                    payload: 'platform-door-pricing',
                    offer_ttl: '',
                  },
                ],
                delivery_days: doorPricing.delivery_days,
                _pricing_source: 'yandex_platform_door',
              })
            }
          }
        } catch (doorErr) {
          console.warn(
            'Platform pricing-calculator (до двери, time_interval) не удался, пробуем Cargo offers/calculate:',
            doorErr,
          )
        }
      } else if (useYandexPvzDropoff && !platformSourceStationId) {
        console.log(
          '[Yandex NDD] Для расчёта «в другой день» до ПВЗ задайте YANDEX_PLATFORM_SOURCE_STATION_ID — platform_station_id склада из POST .../warehouses/list (док: 1.01 pricing-calculator). Сейчас используется только Cargo v2.',
        )
      } else if (!useYandexPvzDropoff && !platformSourceStationId) {
        console.log(
          '[Yandex door] Для межгорода до двери задайте YANDEX_PLATFORM_SOURCE_STATION_ID (station_id склада из POST .../warehouses/list). ' +
            'Иначе расчёт идёт через Cargo offers/calculate — на многих маршрутах он возвращает пустой offers.',
        )
      }

      const calculatePayload = { items, route_points, requirements }
      console.log(
        '--- Yandex offers/calculate OUT (route_points + requirements) ---',
        JSON.stringify(calculatePayload, null, 2),
      )

      let result = await yandexRequest<{ offers: any[]; error_messages?: any[] }>(
        `${CARGO_PATH}/offers/calculate`,
        { body: calculatePayload }
      )

      // Полное тело ответа (в т.ч. error_messages / коды estimating.*) — для отладки пустых offers
      console.log(
        '--- Yandex Delivery Offers Result (full JSON, first offers/calculate) ---',
        JSON.stringify(result, null, 2),
      )

      // Ретраи при пустых offers (door): разные профили — межгород часто даёт только cargo/ndd.
      if (!result.offers?.length && !useYandexPvzDropoff) {
        const doorRetries: Array<Record<string, unknown>> = [
          { taxi_classes: ['cargo'], skip_door_to_door: false },
          { taxi_classes: ['ndd'], skip_door_to_door: false, ndd: true, delivery_type: 'ndd' },
          { taxi_classes: ['courier', 'express'], skip_door_to_door: false },
          { taxi_classes: ['cargo', 'courier', 'express', 'ndd'], skip_door_to_door: false, ndd: true, delivery_type: 'ndd' },
        ]
        for (let i = 0; i < doorRetries.length && !result.offers?.length; i++) {
          const req = { ...requirements, ...doorRetries[i] }
          console.log(
            `--- Yandex door retry ${i + 1}/${doorRetries.length} requirements ---`,
            JSON.stringify(req),
          )
          result = await yandexRequest<{ offers: any[]; error_messages?: any[] }>(
            `${CARGO_PATH}/offers/calculate`,
            { body: { items, route_points, requirements: req } },
          )
          console.log(
            `--- Yandex door retry ${i + 1} result ---`,
            JSON.stringify(result, null, 2),
          )
        }
      }

      // ПВЗ: если пусто — явный NDD (как раньше).
      if (!result.offers?.length && useYandexPvzDropoff) {
        console.log('No offers found (PVZ), retrying with explicit NDD requirements...')
        requirements.taxi_classes = ['ndd']
        requirements.ndd = true
        requirements.delivery_type = 'ndd'

        result = await yandexRequest<{ offers: any[]; error_messages?: any[] }>(
          `${CARGO_PATH}/offers/calculate`,
          { body: { items, route_points, requirements } },
        )
        console.log('--- Yandex Delivery Explicit NDD Result ---', JSON.stringify(result, null, 2))
      }

      if (!result.offers?.length && !useYandexPvzDropoff) {
        const req = {
          ...requirements,
          taxi_classes: ['courier', 'express'],
          skip_door_to_door: false,
        }
        delete (req as { ndd?: unknown }).ndd
        delete (req as { delivery_type?: unknown }).delivery_type

        result = await yandexRequest<{ offers: any[]; error_messages?: any[] }>(
          `${CARGO_PATH}/offers/calculate`,
          { body: { items, route_points, requirements: req } },
        )
        console.log('--- Yandex Delivery Courier-only Fallback ---', JSON.stringify(result, null, 2))
      }

      if (!result.offers?.length) {
        console.warn('Yandex offers/calculate returned empty offers after all retries', {
          dropoffFullname: dropoffFullnameForApi,
          coordinates,
          warehouseCoords: warehouse.coordinates,
          warehouse_point_id: warehouse.point_id ?? null,
          dropoff_point_id: yandexDropoffPointId || null,
          lastError: result.error_messages,
        })
        return json({
          ...result,
          error:
            'По этому маршруту Cargo offers/calculate не вернул тарифы. ' +
            'Для курьера до двери (межгород) нужен Platform API pricing-calculator с тарифом time_interval и переменная YANDEX_PLATFORM_SOURCE_STATION_ID (station_id склада из warehouses/list). ' +
            'Для ПВЗ — tariff self_pickup и тот же station_id. Уточните в поддержке Яндекс Доставки, если расчёт пустой.',
          offers: result.offers || [],
        }, 200)
      }
      return json(result)
    }

    if (action === 'list-pickup-points') {
      const filters = body as {
        geo_id?: number
        type?: 'pickup_point' | 'terminal' | 'warehouse'
        longitude?: { from: number; to: number }
        latitude?: { from: number; to: number }
      }
      const requestBody: Record<string, unknown> = {}
      if (filters.geo_id != null) requestBody.geo_id = filters.geo_id
      if (filters.type) requestBody.type = filters.type
      if (filters.longitude) requestBody.longitude = filters.longitude
      if (filters.latitude) requestBody.latitude = filters.latitude
      const result = await yandexPlatformRequest<{ points: unknown[] }>(
        PLATFORM_PICKUP_LIST_PATH,
        { body: Object.keys(requestBody).length ? requestBody : {} }
      )
      return json(result)
    }

    if (action === 'warehouses-list') {
      const { merchant_id } = body as { merchant_id?: string }
      const mid =
        merchant_id?.trim() ||
        process.env.YANDEX_PLATFORM_MERCHANT_ID?.trim()
      // API Яндекса требует ключ filter; часто нужен filter.merchant_id (см. доку 6.02)
      const requestBody = {
        filter: mid ? { merchant_id: mid } : {},
      }
      const result = await yandexPlatformRequest<{
        warehouses?: Array<{
          station_id?: string
          name?: string
          location?: unknown
          client_warehouse_id?: string
        }>
      }>(PLATFORM_WAREHOUSES_LIST_PATH, { body: requestBody })
      return json(result)
    }

    return json({
      error:
        'Unknown action. Use action: "calculate" | "list-pickup-points" | "warehouses-list"',
    }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('Yandex Delivery API error:', message)
    // Сообщение уже может быть нашим пользовательским (из yandexErrorToMessage)
    if (message.startsWith('YANDEX_DELIVERY_TOKEN') || message.includes('dostavka.yandex') || message.includes('Проверьте') || message.includes('токен')) {
      return json({ error: message }, 400)
    }
    try {
      const err = JSON.parse(message) as Record<string, unknown>
      const msg =
        typeof err.error === 'string'
          ? err.error
          : typeof err.message === 'string'
            ? err.message
            : typeof err.code === 'string'
              ? err.code
              : message
      return json({ error: msg }, 400)
    } catch {
      if (
        /merchant not found/i.test(message) ||
        message.includes('YANDEX_PLATFORM_MERCHANT_ID')
      ) {
        return json({ error: message }, 400)
      }
      return json({ error: message }, 500)
    }
  }
}

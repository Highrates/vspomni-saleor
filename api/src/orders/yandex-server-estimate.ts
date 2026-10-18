/**
 * Серверный пересчёт Яндекс Доставки (без доверия clientEstimate).
 * Platform pricing-calculator (NDD) → fallback Cargo offers/calculate.
 */
import { Logger } from '@nestjs/common';

const PLATFORM_API =
  process.env.YANDEX_DELIVERY_PLATFORM_URL?.trim() ||
  'https://b2b-authproxy.taxi.yandex.net';
const CARGO_API = 'https://b2b.taxi.yandex.net';
const PLATFORM_PRICING = '/api/b2b/platform/pricing-calculator';
const CARGO_CALCULATE = '/b2b/cargo/integration/v2/offers/calculate';

const DEFAULT_WAREHOUSE = {
  fullname: 'Россия, Санкт-Петербург, улица Ватутина, дом 8/7Д',
  coordinates: [30.379738, 59.962021] as [number, number],
  point_id: '019c55f8c0d972ea9b59302a85430825',
};

const logger = new Logger('YandexServerEstimate');

function parsePricingTotalRub(s: string | undefined): number {
  if (!s || typeof s !== 'string') return NaN;
  const m = s.replace(/\s/g, '').match(/^([\d.,]+)/);
  if (!m) return NaN;
  return parseFloat(m[1].replace(',', '.'));
}

function warehouseFromEnv(): {
  fullname: string;
  coordinates: [number, number];
  point_id: string;
} {
  const fullname =
    process.env.YANDEX_DELIVERY_WAREHOUSE_FULLNAME?.trim() ||
    DEFAULT_WAREHOUSE.fullname;
  const envId = process.env.YANDEX_DELIVERY_WAREHOUSE_ID?.trim();
  const lat = Number(process.env.YANDEX_DELIVERY_WAREHOUSE_LAT);
  const lng = Number(process.env.YANDEX_DELIVERY_WAREHOUSE_LNG);
  const coordinates: [number, number] =
    Number.isFinite(lng) && Number.isFinite(lat)
      ? [lng, lat]
      : DEFAULT_WAREHOUSE.coordinates;
  return {
    fullname,
    coordinates,
    point_id: envId || DEFAULT_WAREHOUSE.point_id,
  };
}

function packageFromLines(
  lines: Array<{
    qty: number;
    weightGrams?: number | null;
    lengthMm?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
  }>,
): { weightG: number; lengthCm: number; widthCm: number; heightCm: number } {
  let weightG = 0;
  let volMm3 = 0;
  for (const line of lines) {
    const q = Math.max(1, Math.floor(line.qty || 1));
    weightG += (line.weightGrams ?? 200) * q;
    const l = line.lengthMm ?? 80;
    const w = line.widthMm ?? 55;
    const h = line.heightMm ?? 45;
    volMm3 += l * w * h * q;
  }
  weightG = Math.min(50_000, Math.max(100, Math.round(weightG)));
  const sideMm = Math.cbrt(Math.max(volMm3, 80 * 55 * 45));
  const cm = Math.min(150, Math.max(8, Math.round(sideMm / 10)));
  return { weightG, lengthCm: cm, widthCm: cm, heightCm: cm };
}

async function yandexFetch(
  base: string,
  path: string,
  token: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'ru',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export type YandexEstimateInput = {
  token: string;
  city: string;
  address: string;
  /** Координаты из __VSP__ (lon, lat) */
  lon?: number | null;
  lat?: number | null;
  /** ПВЗ id / platform_station_id */
  pvzId?: string | null;
  usePvz: boolean;
  lines: Array<{
    qty: number;
    weightGrams?: number | null;
    lengthMm?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
  }>;
};

/**
 * @returns стоимость в рублях или null (нет токена / API недоступен)
 */
export async function estimateYandexDeliveryCost(
  input: YandexEstimateInput,
): Promise<number | null> {
  const token = input.token.trim();
  if (!token) return null;

  const pkg = packageFromLines(input.lines);
  const destAddress = [input.city, input.address]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
  const fullDest = destAddress
    ? destAddress.startsWith('Россия')
      ? destAddress
      : `Россия, ${destAddress}`
    : '';

  const sourceStation =
    process.env.YANDEX_PLATFORM_SOURCE_STATION_ID?.trim() || '';

  // 1) Platform pricing-calculator (предпочтительно)
  if (sourceStation) {
    try {
      const destination =
        input.usePvz && input.pvzId?.trim()
          ? { platform_station_id: input.pvzId.trim() }
          : {
              address: fullDest.replace(/^Россия,\s*/i, '').trim() || fullDest,
            };
      const body = {
        source: { platform_station_id: sourceStation },
        destination,
        tariff: input.usePvz ? 'self_pickup' : 'time_interval',
        total_weight: pkg.weightG,
        places: [
          {
            physical_dims: {
              dx: pkg.lengthCm,
              dy: pkg.heightCm,
              dz: pkg.widthCm,
              weight_gross: pkg.weightG,
            },
          },
        ],
      };
      const res = await yandexFetch(PLATFORM_API, PLATFORM_PRICING, token, body);
      if (res.ok) {
        const total = parsePricingTotalRub(
          typeof res.json.pricing_total === 'string'
            ? res.json.pricing_total
            : undefined,
        );
        if (Number.isFinite(total) && total >= 0) {
          return Math.round(total);
        }
      } else {
        logger.warn(
          `Yandex platform pricing ${res.status}: ${JSON.stringify(res.json).slice(0, 200)}`,
        );
      }
    } catch (e) {
      logger.warn(
        `Yandex platform pricing failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // 2) Cargo offers/calculate
  try {
    const wh = warehouseFromEnv();
    const lon = input.lon;
    const lat = input.lat;
    if (
      lon == null ||
      lat == null ||
      !Number.isFinite(lon) ||
      !Number.isFinite(lat)
    ) {
      logger.warn('Yandex cargo estimate: нет координат назначения');
      return null;
    }
    const route_points = [
      {
        id: 1,
        fullname: wh.fullname,
        coordinates: wh.coordinates,
        ...(wh.point_id ? { point_id: wh.point_id } : {}),
      },
      {
        id: 2,
        coordinates: [lon, lat] as [number, number],
        fullname: fullDest || wh.fullname,
        ...(input.usePvz && input.pvzId
          ? { type: 'pvz', point_id: input.pvzId }
          : {}),
      },
    ];
    const items = [
      {
        size: {
          length: pkg.lengthCm / 100,
          width: pkg.widthCm / 100,
          height: pkg.heightCm / 100,
        },
        weight: Math.max(0.001, pkg.weightG / 1000),
        quantity: 1,
        pickup_point: 1,
        dropoff_point: 2,
      },
    ];
    const requirements = input.usePvz
      ? {
          taxi_classes: ['ndd'],
          skip_door_to_door: true,
          ndd: true,
          delivery_type: 'ndd',
        }
      : {
          taxi_classes: ['cargo', 'courier', 'express', 'ndd'],
          skip_door_to_door: false,
        };

    const res = await yandexFetch(CARGO_API, CARGO_CALCULATE, token, {
      items,
      route_points,
      requirements,
    });
    if (!res.ok) {
      logger.warn(
        `Yandex cargo calculate ${res.status}: ${JSON.stringify(res.json).slice(0, 200)}`,
      );
      return null;
    }
    const offers = Array.isArray(res.json.offers)
      ? (res.json.offers as Array<{ price?: { total_price?: string } }>)
      : [];
    let min = Infinity;
    for (const o of offers) {
      const raw = o.price?.total_price;
      if (!raw) continue;
      const n = parseFloat(String(raw).replace(',', '.').replace(/[^\d.]/g, ''));
      if (Number.isFinite(n) && n >= 0 && n < min) min = n;
    }
    return min === Infinity ? null : Math.round(min);
  } catch (e) {
    logger.warn(
      `Yandex cargo estimate failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

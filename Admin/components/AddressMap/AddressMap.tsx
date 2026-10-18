'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './AddressMap.module.css';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ymaps?: any;
  }
}

const YANDEX_MAP_API_KEY = process.env.NEXT_PUBLIC_YANDEX_MAP_API_KEY || '';

export type AddressMapResult = {
  lat: number;
  lon: number;
  addressLine: string;
  city?: string;
  region?: string;
  postalCode?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGeoObject(geoObject: any): AddressMapResult | null {
  if (!geoObject?.geometry) return null;
  const coords = geoObject.geometry.getCoordinates();
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lat = Number(coords[0]);
  const lon = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const addressLine = String(geoObject.getAddressLine?.() || '').trim();
  let city = '';
  let region = '';
  let postalCode = '';
  try {
    const meta =
      geoObject.properties?.get?.('metaDataProperty')?.GeocoderMetaData?.Address;
    if (meta) {
      postalCode = String(meta.postal_code || '').trim();
      const components = meta.Components || [];
      for (const c of components) {
        if (c.kind === 'locality') city = c.name || city;
        if (c.kind === 'province' || c.kind === 'area') region = c.name || region;
      }
    }
  } catch {
    /* ignore */
  }

  return { lat, lon, addressLine, city, region, postalCode };
}

type Props = {
  onSelect: (result: AddressMapResult) => void;
  hintCity?: string;
  /** Load map immediately (e.g. inside open modal). */
  eager?: boolean;
};

export function AddressMap({
  onSelect,
  hintCity = 'Москва',
  eager = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placemarkRef = useRef<any>(null);
  const [scriptShouldLoad, setScriptShouldLoad] = useState(eager);
  const [mapLoading, setMapLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [lastResult, setLastResult] = useState<AddressMapResult | null>(null);

  useEffect(() => {
    if (eager) {
      setScriptShouldLoad(true);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setScriptShouldLoad(true);
      },
      { rootMargin: '100px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!scriptShouldLoad) return;
    if (!YANDEX_MAP_API_KEY) {
      setError('Не указан NEXT_PUBLIC_YANDEX_MAP_API_KEY');
      setMapLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      if (window.ymaps) {
        await new Promise<void>((r) => window.ymaps!.ready(() => r()));
        if (!cancelled) setMapLoading(false);
        return;
      }
      const existing = document.getElementById(
        'yandex-maps-api-script',
      ) as HTMLScriptElement | null;
      const script = existing || document.createElement('script');
      if (!existing) {
        script.id = 'yandex-maps-api-script';
        script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAP_API_KEY}&lang=ru_RU`;
        script.async = true;
        document.head.appendChild(script);
      }
      await new Promise<void>((resolve, reject) => {
        if (window.ymaps) {
          resolve();
          return;
        }
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error('Не удалось загрузить Яндекс Карты'));
      });
      await new Promise<void>((r) => window.ymaps!.ready(() => r()));
      if (!cancelled) setMapLoading(false);
    };
    load().catch((e: Error) => {
      if (!cancelled) {
        setError(e?.message || 'Ошибка карты');
        setMapLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scriptShouldLoad]);

  const movePlacemark = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lat: number, lon: number, geoObject: any) => {
      const parsed = parseGeoObject(geoObject);
      if (!parsed) return;
      if (!mapRef.current || !window.ymaps) return;

      if (placemarkRef.current) {
        mapRef.current.geoObjects.remove(placemarkRef.current);
        placemarkRef.current = null;
      }
      placemarkRef.current = new window.ymaps.Placemark(
        [lat, lon],
        {
          balloonContentHeader: 'Адрес доставки',
          balloonContentBody: parsed.addressLine || 'Адрес уточнён',
        },
        { draggable: true, preset: 'islands#blueDotIcon' },
      );
      placemarkRef.current.events.add('dragend', () => {
        const pos = placemarkRef.current.geometry.getCoordinates();
        window.ymaps!.geocode(pos).then((res: { geoObjects: { get: (i: number) => unknown } }) => {
          const first = res.geoObjects.get(0);
          if (!first) return;
          const p = parseGeoObject(first);
          if (p) {
            setLastResult(p);
            onSelect(p);
          }
        });
      });
      mapRef.current.geoObjects.add(placemarkRef.current);
      mapRef.current.setCenter([lat, lon], 16);
      setLastResult(parsed);
      onSelect(parsed);
    },
    [onSelect],
  );

  const movePlacemarkRef = useRef(movePlacemark);
  movePlacemarkRef.current = movePlacemark;

  useEffect(() => {
    if (mapLoading || !window.ymaps || !containerRef.current) return;

    mapRef.current = new window.ymaps.Map(
      containerRef.current,
      {
        center: [55.751574, 37.573856],
        zoom: 10,
        controls: ['zoomControl', 'geolocationControl'],
      },
      { suppressMapOpenBlock: true },
    );

    mapRef.current.events.add('click', (e: { get: (k: string) => number[] }) => {
      const coords = e.get('coords');
      window.ymaps!.geocode(coords).then((res: { geoObjects: { get: (i: number) => unknown } }) => {
        const first = res.geoObjects.get(0);
        if (!first) return;
        movePlacemarkRef.current(coords[0]!, coords[1]!, first);
      });
    });

    window.ymaps.geocode(`Россия, ${hintCity}`).then((res: { geoObjects: { get: (i: number) => { geometry: { getCoordinates: () => number[] } } | null } }) => {
      const first = res.geoObjects.get(0);
      if (first && mapRef.current) {
        const c = first.geometry.getCoordinates();
        mapRef.current.setCenter(c, 11);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      placemarkRef.current = null;
    };
  }, [mapLoading, hintCity]);

  const handleSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (!q || !window.ymaps) return;
    setSearchBusy(true);
    const query = q.includes('Россия') ? q : `Россия, ${q}`;
    window.ymaps
      .geocode(query)
      .then((res: { geoObjects: { get: (i: number) => { geometry: { getCoordinates: () => number[] } } | null } }) => {
        const first = res.geoObjects.get(0);
        if (!first) {
          setSearchBusy(false);
          return;
        }
        const coords = first.geometry.getCoordinates();
        movePlacemark(coords[0]!, coords[1]!, first);
        setSearchBusy(false);
      })
      .catch(() => setSearchBusy(false));
  }, [searchQuery, movePlacemark]);

  if (error) {
    return (
      <div className={styles.error} role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Введите адрес и нажмите «Найти» или кликните по карте — метку можно
        перетащить.
      </p>
      <div className={styles.searchRow}>
        <input
          type="text"
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
          placeholder="Город, улица, дом"
        />
        <button
          type="button"
          className={styles.searchBtn}
          onClick={handleSearch}
          disabled={searchBusy || !searchQuery.trim()}
        >
          {searchBusy ? '…' : 'Найти'}
        </button>
      </div>

      <div ref={containerRef} className={styles.map}>
        {scriptShouldLoad && mapLoading ? (
          <div className={styles.mapOverlay}>Загрузка карты…</div>
        ) : null}
      </div>

      {lastResult ? (
        <div className={styles.selected}>
          <p className={styles.selectedTitle}>Адрес с карты</p>
          <p className={styles.selectedLine}>
            {lastResult.addressLine ||
              'Уточните адрес поиском или перетащите метку'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PvzMap.module.css';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ymaps?: any;
  }
}

const YANDEX_MAP_API_KEY = process.env.NEXT_PUBLIC_YANDEX_MAP_API_KEY || '';

export type PvzMapPoint = {
  id: string;
  title: string;
  address: string;
  lat: number;
  lon: number;
  meta?: string;
};

type Props = {
  points: PvzMapPoint[];
  onSelect: (point: PvzMapPoint) => void;
  /** Центр [lat, lon] — обычно город */
  center?: [number, number] | null;
  selectedId?: string | null;
  eager?: boolean;
};

function ensureYmapsScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps!.ready(() => resolve());
    });
  }
  return new Promise((resolve, reject) => {
    let el = document.getElementById(
      'yandex-maps-api-script',
    ) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = 'yandex-maps-api-script';
      el.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAP_API_KEY}&lang=ru_RU`;
      el.async = true;
      document.head.appendChild(el);
    }
    const onLoad = () => {
      if (!window.ymaps) {
        reject(new Error('Яндекс.Карты не загрузились'));
        return;
      }
      window.ymaps.ready(() => resolve());
    };
    el.addEventListener('load', onLoad);
    el.addEventListener('error', () =>
      reject(new Error('Не удалось загрузить Яндекс.Карты')),
    );
    if (window.ymaps) onLoad();
  });
}

export function PvzMap({
  points,
  onSelect,
  center = null,
  selectedId = null,
  eager = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clustererRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  const [shouldLoad, setShouldLoad] = useState(eager);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  onSelectRef.current = onSelect;

  useEffect(() => {
    if (eager) {
      setShouldLoad(true);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setShouldLoad(true);
      },
      { rootMargin: '80px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!shouldLoad) return;
    if (!YANDEX_MAP_API_KEY) {
      setError('Не указан NEXT_PUBLIC_YANDEX_MAP_API_KEY');
      setMapLoading(false);
      return;
    }
    let cancelled = false;
    setMapLoading(true);
    setError(null);
    void ensureYmapsScript()
      .then(() => {
        if (!cancelled) setMapLoading(false);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка карты');
          setMapLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [shouldLoad]);

  useEffect(() => {
    if (mapLoading || !window.ymaps || !containerRef.current) return;
    setMapReady(false);
    if (mapRef.current) {
      mapRef.current.destroy();
      mapRef.current = null;
    }
    const defaultCenter: [number, number] = center ?? [55.751574, 37.573856];
    mapRef.current = new window.ymaps.Map(
      containerRef.current,
      {
        center: defaultCenter,
        zoom: 11,
        controls: ['zoomControl', 'fullscreenControl'],
      },
      { suppressMapOpenBlock: true },
    );
    clustererRef.current = new window.ymaps.Clusterer({
      preset: 'islands#blackClusterIcons',
      groupByCoordinates: false,
    });
    mapRef.current.geoObjects.add(clustererRef.current);
    setMapReady(true);
    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      clustererRef.current = null;
      setMapReady(false);
    };
  }, [mapLoading, center?.[0], center?.[1]]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !clustererRef.current || !window.ymaps) {
      return;
    }
    clustererRef.current.removeAll();
    const withCoords = points.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon),
    );
    if (withCoords.length === 0) return;

    const placemarks = withCoords.map((pvz) => {
      const isSelected = selectedId != null && pvz.id === selectedId;
      const placemark = new window.ymaps!.Placemark(
        [pvz.lat, pvz.lon],
        {
          balloonContentHeader: `<strong>${escapeHtml(pvz.title)}</strong>`,
          balloonContentBody: `<div style="padding:6px 0">${escapeHtml(pvz.address)}${
            pvz.meta
              ? `<div style="margin-top:6px;color:#666;font-size:12px">${escapeHtml(pvz.meta)}</div>`
              : ''
          }</div>`,
          hintContent: pvz.title,
        },
        {
          preset: isSelected
            ? 'islands#darkOrangeDotIcon'
            : 'islands#blackDotIcon',
        },
      );
      placemark.events.add('click', () => {
        onSelectRef.current(pvz);
      });
      return placemark;
    });
    clustererRef.current.add(placemarks);

    if (selectedId) {
      const selected = withCoords.find((p) => p.id === selectedId);
      if (selected) {
        mapRef.current.setCenter([selected.lat, selected.lon], 15, {
          duration: 300,
        });
        return;
      }
    }
    if (withCoords.length === 1 && !center) {
      mapRef.current.setCenter([withCoords[0].lat, withCoords[0].lon], 14);
    } else if (withCoords.length > 1) {
      try {
        const bounds = window.ymaps.util.bounds.fromPoints(
          withCoords.map((p) => [p.lat, p.lon]),
        );
        mapRef.current.setBounds(bounds, {
          checkZoomRange: true,
          zoomMargin: 48,
        });
      } catch {
        /* ignore */
      }
    }
  }, [mapReady, points, selectedId, center]);

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Нажмите метку на карте или выберите пункт в списке
      </p>
      <div ref={containerRef} className={styles.map}>
        {!shouldLoad ? (
          <div className={styles.overlay}>Карта загрузится при просмотре</div>
        ) : null}
        {shouldLoad && mapLoading ? (
          <div className={styles.overlay}>Загрузка карты…</div>
        ) : null}
        {shouldLoad &&
        !mapLoading &&
        points.filter((p) => Number.isFinite(p.lat)).length === 0 ? (
          <div className={styles.overlay}>
            Нет пунктов с координатами для карты
          </div>
        ) : null}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

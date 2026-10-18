'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  catalogDisplayCityForUserCity,
  orderedYandexPvzCityNames,
  resolveYandexGeoId,
} from '@/lib/shipping/yandexCityGeo';
import { getPickupPoints } from '@/lib/shipping/yandexDelivery';
import type { YandexPickupPoint } from '@/lib/shipping/types';
import { PvzMap, type PvzMapPoint } from './PvzMap';
import styles from './shippingPicker.module.css';

type Props = {
  onChoose: (point: YandexPickupPoint) => void;
  defaultCity?: string;
  selectedPointId?: string | null;
};

export function YandexPvzPicker({
  onChoose,
  defaultCity = 'Москва',
  selectedPointId = null,
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const cities = useMemo(() => orderedYandexPvzCityNames(), []);
  const [pickedCity, setPickedCity] = useState(() =>
    catalogDisplayCityForUserCity(defaultCity),
  );
  const [cityQuery, setCityQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [points, setPoints] = useState<YandexPickupPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pvzQuery, setPvzQuery] = useState('');
  const prevDefault = useRef(defaultCity);

  useEffect(() => {
    if (prevDefault.current !== defaultCity) {
      prevDefault.current = defaultCity;
      setPickedCity(catalogDisplayCityForUserCity(defaultCity));
    }
  }, [defaultCity]);

  useEffect(() => {
    if (!pickedCity) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setPoints([]);
      try {
        const geoId = resolveYandexGeoId(pickedCity);
        const res = await getPickupPoints(
          geoId != null ? { geo_id: geoId } : undefined,
        );
        if (cancelled) return;
        setPoints(Array.isArray(res.points) ? res.points : []);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Не удалось загрузить ПВЗ Яндекса',
          );
          setPoints([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickedCity]);

  useEffect(() => {
    if (!showDropdown) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(t)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showDropdown]);

  const filteredCities = useMemo(() => {
    if (!cityQuery.trim()) return cities.slice(0, 40);
    const q = cityQuery.toLowerCase().trim();
    return cities.filter((c) => c.toLowerCase().includes(q)).slice(0, 40);
  }, [cities, cityQuery]);

  const filteredPvz = useMemo(() => {
    if (!pvzQuery.trim()) return points;
    const q = pvzQuery.toLowerCase();
    return points.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.address?.full_address || '').toLowerCase().includes(q) ||
        (p.instruction || '').toLowerCase().includes(q),
    );
  }, [points, pvzQuery]);

  const mapPoints = useMemo((): PvzMapPoint[] => {
    const out: PvzMapPoint[] = [];
    for (const p of filteredPvz) {
      const lat = Number(p.position?.latitude);
      const lon = Number(p.position?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      out.push({
        id: p.id,
        title: p.name || 'Пункт выдачи',
        address: p.address?.full_address || '',
        lat,
        lon,
        meta: p.instruction,
      });
    }
    return out;
  }, [filteredPvz]);

  const handleMapSelect = (point: PvzMapPoint) => {
    const raw = filteredPvz.find((p) => p.id === point.id);
    if (raw) onChoose(raw);
  };

  if (loading && points.length === 0 && !error) {
    return <p className={styles.status}>Загрузка пунктов выдачи Яндекса…</p>;
  }

  if (error && points.length === 0) {
    return <p className={styles.error}>{error}</p>;
  }

  return (
    <div className={styles.root}>
      {error && points.length > 0 ? (
        <p className={styles.error}>{error}</p>
      ) : null}
      {loading && points.length > 0 ? (
        <p className={styles.status}>Обновление списка…</p>
      ) : null}

      <div className={styles.cityWrap} ref={wrapRef}>
        <p className={styles.fieldLabel}>Город</p>
        <button
          type="button"
          className={styles.cityBtn}
          aria-haspopup="listbox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          onClick={() => setShowDropdown((v) => !v)}
        >
          <span className={pickedCity ? undefined : styles.cityPlaceholder}>
            {pickedCity || 'Выберите город'}
          </span>
          <span aria-hidden>▾</span>
        </button>
        {showDropdown ? (
          <ul id={listId} className={styles.dropdown} role="listbox">
            <li>
              <input
                className={styles.searchInput}
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder="Поиск города"
                autoFocus
              />
            </li>
            {filteredCities.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  role="option"
                  className={[
                    styles.dropdownItem,
                    pickedCity === c ? styles.dropdownItemActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setPickedCity(c);
                    setCityQuery('');
                    setShowDropdown(false);
                    setPvzQuery('');
                  }}
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <p className={styles.fieldLabel}>Пункт выдачи</p>
        <input
          className={styles.searchInput}
          value={pvzQuery}
          onChange={(e) => setPvzQuery(e.target.value)}
          placeholder="Поиск по адресу или названию"
          disabled={loading}
        />
      </div>

      {!loading && filteredPvz.length === 0 ? (
        <p className={styles.status}>Пункты не найдены</p>
      ) : (
        <div className={styles.split}>
          <PvzMap
            points={mapPoints}
            onSelect={handleMapSelect}
            selectedId={selectedPointId}
          />
          <ul className={styles.list}>
            {filteredPvz.map((p) => {
              const selected = selectedPointId === p.id;
              const addr = p.address?.full_address || '';
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={[
                      styles.listItem,
                      selected ? styles.listItemSelected : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => onChoose(p)}
                  >
                    <span className={styles.itemTitle}>
                      {p.name || 'Пункт выдачи'}
                    </span>
                    {addr ? (
                      <span className={styles.itemMeta}>{addr}</span>
                    ) : null}
                    {p.instruction ? (
                      <span className={styles.itemMeta}>{p.instruction}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

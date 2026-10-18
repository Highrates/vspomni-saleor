'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getCities, getDeliveryPoints } from '@/lib/shipping/cdek';
import type { CdekCity, CdekDeliveryPoint } from '@/lib/shipping/types';
import { PvzMap, type PvzMapPoint } from './PvzMap';
import styles from './shippingPicker.module.css';

export type CdekPvzChoice = {
  id: string;
  cityName: string;
  cityCode: string;
  address: string;
  name: string;
  region?: string;
  postalCode?: string;
  workTime?: string;
  lat?: number;
  lon?: number;
};

type Props = {
  onChoose: (info: CdekPvzChoice) => void;
  defaultCity?: string;
  selectedPvzId?: string | null;
};

const PRIORITY = ['Москва', 'Санкт-Петербург'] as const;

function mapPoint(p: CdekDeliveryPoint, city: CdekCity | null): CdekPvzChoice {
  return {
    id: p.code,
    cityName: p.location?.city || city?.city || '',
    cityCode: String(p.location?.city_code || city?.code || ''),
    address: p.location?.address || p.location?.address_full || '',
    name: p.name || 'ПВЗ СДЭК',
    region: p.location?.region || city?.region,
    postalCode: p.location?.postal_code,
    workTime: p.work_time,
    lat: p.location?.latitude,
    lon: p.location?.longitude,
  };
}

export function CdekPvzPicker({
  onChoose,
  defaultCity = 'Москва',
  selectedPvzId = null,
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cities, setCities] = useState<CdekCity[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<CdekCity | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [pvzList, setPvzList] = useState<CdekDeliveryPoint[]>([]);
  const [pvzLoading, setPvzLoading] = useState(false);
  const [pvzError, setPvzError] = useState<string | null>(null);
  const [pvzQuery, setPvzQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCitiesLoading(true);
      setCitiesError(null);
      try {
        const data = await getCities({
          country_codes: 'RU',
          size: 200,
        });
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const sorted = [...list].sort((a, b) =>
          a.city.localeCompare(b.city, 'ru'),
        );
        const priority = PRIORITY.map((name) =>
          sorted.find((c) => c.city === name),
        ).filter(Boolean) as CdekCity[];
        const rest = sorted.filter(
          (c) => c.city !== 'Москва' && c.city !== 'Санкт-Петербург',
        );
        const ordered = [...priority, ...rest];
        setCities(ordered);
        const def =
          ordered.find(
            (c) => c.city.toLowerCase() === defaultCity.toLowerCase(),
          ) ||
          ordered.find((c) => c.city === 'Москва') ||
          ordered[0] ||
          null;
        setSelectedCity(def);
      } catch (e) {
        if (!cancelled) {
          setCitiesError(
            e instanceof Error ? e.message : 'Не удалось загрузить города',
          );
        }
      } finally {
        if (!cancelled) setCitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultCity]);

  useEffect(() => {
    if (!selectedCity) return;
    let cancelled = false;
    (async () => {
      setPvzLoading(true);
      setPvzError(null);
      setPvzList([]);
      try {
        const points = await getDeliveryPoints({
          city_code: selectedCity.code,
          city_uuid: selectedCity.city_uuid,
          size: 150,
        });
        if (cancelled) return;
        setPvzList(Array.isArray(points) ? points : []);
      } catch (e) {
        if (!cancelled) {
          setPvzError(
            e instanceof Error ? e.message : 'Не удалось загрузить пункты',
          );
          setPvzList([]);
        }
      } finally {
        if (!cancelled) setPvzLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCity]);

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
    return cities.filter((c) => c.city.toLowerCase().includes(q)).slice(0, 40);
  }, [cities, cityQuery]);

  const filteredPvz = useMemo(() => {
    if (!pvzQuery.trim()) return pvzList;
    const q = pvzQuery.toLowerCase();
    return pvzList.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const addr = (p.location?.address || '').toLowerCase();
      return name.includes(q) || addr.includes(q);
    });
  }, [pvzList, pvzQuery]);

  const mapPoints = useMemo((): PvzMapPoint[] => {
    const out: PvzMapPoint[] = [];
    for (const p of filteredPvz) {
      const choice = mapPoint(p, selectedCity);
      const lat = Number(choice.lat);
      const lon = Number(choice.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      out.push({
        id: choice.id,
        title: choice.name,
        address: choice.address,
        lat,
        lon,
        meta: choice.workTime,
      });
    }
    return out;
  }, [filteredPvz, selectedCity]);

  const mapCenter: [number, number] | null = useMemo(() => {
    const lat = Number(selectedCity?.latitude);
    const lon = Number(selectedCity?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
    return null;
  }, [selectedCity]);

  const handleMapSelect = (point: PvzMapPoint) => {
    const raw = filteredPvz.find((p) => p.code === point.id);
    if (!raw) return;
    onChoose(mapPoint(raw, selectedCity));
  };

  if (citiesLoading) {
    return <p className={styles.status}>Загрузка городов СДЭК…</p>;
  }

  if (citiesError && !cities.length) {
    return <p className={styles.error}>{citiesError}</p>;
  }

  return (
    <div className={styles.root}>
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
          <span
            className={
              selectedCity ? undefined : styles.cityPlaceholder
            }
          >
            {selectedCity?.city || 'Выберите город'}
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
              <li key={`${c.code}-${c.city_uuid}`}>
                <button
                  type="button"
                  role="option"
                  className={[
                    styles.dropdownItem,
                    selectedCity?.code === c.code
                      ? styles.dropdownItemActive
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setSelectedCity(c);
                    setCityQuery('');
                    setShowDropdown(false);
                    setPvzQuery('');
                  }}
                >
                  {c.city}
                  {c.region ? ` · ${c.region}` : ''}
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
          disabled={pvzLoading || !selectedCity}
        />
      </div>

      {pvzError ? <p className={styles.error}>{pvzError}</p> : null}

      {pvzLoading ? (
        <p className={styles.status}>Загрузка пунктов…</p>
      ) : filteredPvz.length === 0 ? (
        <p className={styles.status}>Пункты не найдены</p>
      ) : (
        <div className={styles.split}>
          <PvzMap
            points={mapPoints}
            onSelect={handleMapSelect}
            center={mapCenter}
            selectedId={selectedPvzId}
          />
          <ul className={styles.list}>
            {filteredPvz.map((p) => {
              const choice = mapPoint(p, selectedCity);
              const selected = selectedPvzId === choice.id;
              return (
                <li key={choice.id}>
                  <button
                    type="button"
                    className={[
                      styles.listItem,
                      selected ? styles.listItemSelected : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => onChoose(choice)}
                  >
                    <span className={styles.itemTitle}>{choice.name}</span>
                    <span className={styles.itemMeta}>{choice.address}</span>
                    {choice.workTime ? (
                      <span className={styles.itemMeta}>{choice.workTime}</span>
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

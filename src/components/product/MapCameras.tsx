'use client';

import {useEffect, useRef} from 'react';
import {useTranslations} from 'next-intl';
import type {Map as MapLibreMap, Marker} from 'maplibre-gl';
import type {CctvRecord} from '@/types/domain';
import {useCctvRegistry} from './useCctvRegistry';

export function MapCameras({map, onSelect}: {map: MapLibreMap; onSelect: (item: CctvRecord) => void}) {
  const {items} = useCctvRegistry();
  const t = useTranslations();
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    let active = true;
    const markers: Marker[] = [];
    void import('maplibre-gl').then(({Marker}) => {
      if (!active) return;
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'map-camera-marker';
        button.textContent = 'CCTV';
        button.setAttribute('aria-label', `${t('nav.cctv')} · ${t(item.nameKey as never)}`);
        button.title = t(item.nameKey as never);
        button.addEventListener('click', event => { event.stopPropagation(); selectRef.current(item); });
        markers.push(new Marker({element: button}).setLngLat([item.lng, item.lat]).addTo(map));
      }
    });
    return () => { active = false; markers.forEach(marker => marker.remove()); };
  }, [items, map, t]);
  return null;
}

'use client';

import {useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {GridFrame, GridModel, GridVariable} from '@/types/domain';
import {interpolateFrames} from '@/lib/grid/interpolate';
import {WeatherCanvasOverlay} from './WeatherCanvasOverlay';

const legendTicks: Record<GridVariable, number[]> = {
  wind: [0, 5, 10, 15, 20, 25],
  rain: [0, 1, 5, 10, 20, 40],
  temp: [-10, 0, 10, 20, 30, 40],
  wave: [0, .5, 1, 2, 3, 5]
};

export function MapStage({compact = false, onLocationSelect, onMapReady, layer = 'wind', model = 'GFS', timeValue = 0}: {compact?: boolean; onLocationSelect?: (lat: number, lng: number) => void; onMapReady?: (map: import('maplibre-gl').Map) => void; layer?: GridVariable; model?: GridModel; timeValue?: number}) {
  const productT = useTranslations('product');
  const t = useTranslations();
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const selectRef = useRef(onLocationSelect);
  const mapReadyRef = useRef(onMapReady);
  const dragging = useRef(false);
  const [ready, setReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<import('maplibre-gl').Map | null>(null);
  const [moved, setMoved] = useState(false);
  const [gridFrame, setGridFrame] = useState<GridFrame | null>(null);
  selectRef.current = onLocationSelect;
  mapReadyRef.current = onMapReady;

  useEffect(() => {
    let active = true;
    let resizeObserver: ResizeObserver | undefined;
    async function mount() {
      const {Map, Marker, setWorkerUrl} = await import('maplibre-gl');
      if (!active || !container.current || mapRef.current) return;
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const isLight = document.documentElement.dataset.theme === 'light';
      const map = new Map({
        container: container.current,
        style: `https://tiles.openfreemap.org/styles/${isLight ? 'positron' : 'liberty'}`,
        center: [126.48, 33.40], zoom: compact ? 9.6 : 8.85, pitch: 0, bearing: 0,
        attributionControl: false, dragRotate: false, touchPitch: false
      });
      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container.current);
      requestAnimationFrame(() => map.resize());
      map.on('dragstart', () => setMoved(true));
      map.on('zoomstart', () => setMoved(true));
      map.on('load', () => {
        if (!active) return;
        map.resize();
        const marker = new Marker({color: 'var(--accent)'}).setLngLat([126.3092, 33.4621]).addTo(map);
        map.on('click', event => {
          marker.setLngLat(event.lngLat);
          selectRef.current?.(event.lngLat.lat, event.lngLat.lng);
        });
        setMapInstance(map);
        mapReadyRef.current?.(map);
        setReady(true);
      });
    }
    mount();
    return () => { active = false; resizeObserver?.disconnect(); setMapInstance(null); mapRef.current?.remove(); mapRef.current = null; };
  }, [compact]);

  useEffect(() => {
    const controller = new AbortController();
    const hours = timeValue / 100 * 120;
    const step0 = Math.floor(hours / 3) * 3, step1 = Math.min(120, step0 + 3), fraction = (hours - step0) / Math.max(1, step1 - step0);
    Promise.all([step0, step1].map(step => fetch(`/api/v1/grid/${layer}?step=${step}&model=${model}`, {signal: controller.signal}).then(response => response.json())))
      .then(([a, b]: Array<{data: GridFrame}>) => { const frame = interpolateFrames(a.data, b.data, fraction); setGridFrame(frame); }).catch(() => undefined);
    return () => controller.abort();
  }, [layer, model, timeValue, ready]);

  const valueRange = gridFrame ? {
    min: Math.min(...gridFrame.values),
    max: Math.max(...gridFrame.values)
  } : null;
  const modelRun = gridFrame ? new Intl.DateTimeFormat(locale, {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul'}).format(new Date(gridFrame.runAt)) : null;

  return <div className="map-stage" data-map-interactive="true" data-map-moved={moved}
    onPointerDown={() => { dragging.current = true; }}
    onPointerMove={event => { if (dragging.current && event.buttons === 1) setMoved(true); }}
    onPointerUp={() => { dragging.current = false; }}>
    <div ref={container} className="map-canvas" role="region" aria-label={productT('mapLabel')} />
    <div className="map-tint" aria-hidden="true" />
    <WeatherCanvasOverlay frame={gridFrame} map={mapInstance}/>
    {!ready && <div className="map-loading" role="status">{productT('mapLoading')}</div>}
    <div className="grid-source"><strong>{t(`layers.${layer}` as never)}</strong><span>{t((gridFrame?.sourceLabelKey ?? 'sources.gridPreview') as never)}</span>{valueRange && <em>{valueRange.min.toFixed(1)}–{valueRange.max.toFixed(1)} {gridFrame?.units}</em>}
      {gridFrame && <div className={`grid-scale grid-scale-${layer}`} aria-hidden="true"><i/><div>{legendTicks[layer].map(value => <span key={value}>{value}</span>)}</div><small>{gridFrame.units}</small></div>}
      {modelRun && <time dateTime={gridFrame?.runAt}>{t('timeline.gridReference', {hour: Math.round(timeValue / 100 * 120), time: modelRun})}</time>}</div>
    <div className="map-attribution"><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">{'OpenFreeMap'}</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{'© OpenStreetMap'}</a></div>
  </div>;
}

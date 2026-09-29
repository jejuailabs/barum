'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {GridFrame, GridModel, GridVariable} from '@/types/domain';
import {interpolateFrames} from '@/lib/grid/interpolate';
import {WeatherCanvasOverlay} from './WeatherCanvasOverlay';
import {createFrameCache, forecastSteps, GridUnavailableError} from '@/lib/grid/frameCache';

const frameCache = createFrameCache();

const legendTicks: Record<GridVariable, number[]> = {
  wind: [0, 2.5, 5, 10, 15, 20, 31, 40],
  rain: [.1, .3, 1, 2, 5, 10, 20, 40],
  temp: [-30, -20, -10, 0, 10, 20, 30, 45],
  wave: [.1, .5, 1, 1.5, 2, 3.5, 6, 9]
};

export function MapStage({compact = false, onLocationSelect, onMapReady, onGridRun, layer = 'wind', model = 'GFS', timeValue = 0}: {compact?: boolean; onLocationSelect?: (lat: number, lng: number) => void; onMapReady?: (map: import('maplibre-gl').Map) => void; onGridRun?: (at: number) => void; layer?: GridVariable; model?: GridModel; timeValue?: number}) {
  const productT = useTranslations('product');
  const mapT = useTranslations('mapUi');
  const t = useTranslations();
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const selectRef = useRef(onLocationSelect);
  const mapReadyRef = useRef(onMapReady);
  const runRef = useRef(onGridRun);
  runRef.current = onGridRun;
  const dragging = useRef(false);
  const [ready, setReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<import('maplibre-gl').Map | null>(null);
  const [moved, setMoved] = useState(false);
  const [gridFrame, setGridFrame] = useState<GridFrame | null>(null);
  const [gridModel, setGridModel] = useState<GridModel | null>(null);
  const [gridError, setGridError] = useState<'unavailable' | 'load' | null>(null);
  selectRef.current = onLocationSelect;
  mapReadyRef.current = onMapReady;

  useEffect(() => {
    let active = true;
    let resizeObserver: ResizeObserver | undefined;
    let themeObserver: MutationObserver | undefined;
    async function mount() {
      const {Map, Marker, setWorkerUrl} = await import('maplibre-gl');
      if (!active || !container.current || mapRef.current) return;
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const isLight = document.documentElement.dataset.theme === 'light';
      const map = new Map({
        container: container.current,
        style: `https://tiles.openfreemap.org/styles/${isLight ? 'positron' : 'dark'}`,
        center: [126.48, 33.40], zoom: compact ? 9.6 : 6.7, pitch: 0, bearing: 0,
        pixelRatio: Math.min(1.5, window.devicePixelRatio || 1),
        attributionControl: false, dragRotate: false, touchPitch: false,
        maxPitch: 0
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container.current);
      requestAnimationFrame(() => map.resize());
      map.on('dragstart', () => setMoved(true));
      map.on('zoomstart', () => setMoved(true));
      map.on('load', () => {
        if (!active) return;
        map.resize();
        const paintLabels = () => {
          const tokens = getComputedStyle(document.documentElement);
          const color = (name: string) => tokens.getPropertyValue(name).trim();
          for (const styleLayer of map.getStyle().layers) {
            if (styleLayer.type === 'symbol' && styleLayer.layout?.['text-field']) {
              map.setPaintProperty(styleLayer.id, 'text-color', color('--map-label'));
              map.setPaintProperty(styleLayer.id, 'text-halo-color', color('--map-label-halo'));
              map.setPaintProperty(styleLayer.id, 'text-halo-width', 1.2);
            }
            if (styleLayer.type === 'line') {
              map.setPaintProperty(styleLayer.id, 'line-color', color('--map-boundary'));
              map.setPaintProperty(styleLayer.id, 'line-opacity', ['interpolate', ['linear'], ['zoom'], 4, .2, 9, .35, 12, .7]);
            }
          }
        };
        paintLabels();
        themeObserver = new MutationObserver(paintLabels);
        themeObserver.observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
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
    return () => { active = false; resizeObserver?.disconnect(); themeObserver?.disconnect(); setMapInstance(null); mapRef.current?.remove(); mapRef.current = null; };
  }, [compact]);

  useEffect(() => {
    let active = true;
    setGridError(null);
    const {from, to, fraction} = forecastSteps(timeValue);
    const timer = setTimeout(() => {
      Promise.all([frameCache.get(layer, model, from), frameCache.get(layer, model, to)])
        .then(([a, b]) => {
          if (!active) return;
          setGridFrame(fraction === 0 ? a : interpolateFrames(a, b, fraction));
          setGridModel(model);
          runRef.current?.(Date.parse(a.runAt));
          setGridError(null);
        }).catch(error => { if (active) { setGridFrame(null); setGridModel(null); setGridError(error instanceof GridUnavailableError ? 'unavailable' : 'load'); } });
    }, 80);
    return () => { active = false; clearTimeout(timer); };
  }, [layer, model, timeValue]);

  const displayedFrame = gridFrame?.variable === layer && gridModel === model ? gridFrame : null;
  const valueRange = useMemo(() => displayedFrame ? {
    min: Math.min(...displayedFrame.values),
    max: Math.max(...displayedFrame.values)
  } : null, [displayedFrame]);
  const modelRun = displayedFrame ? new Intl.DateTimeFormat(locale, {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul'}).format(new Date(displayedFrame.runAt)) : null;

  return <div className="map-stage" data-map-interactive="true" data-map-moved={moved}
    onPointerDown={() => { dragging.current = true; }}
    onPointerMove={event => { if (dragging.current && event.buttons === 1) setMoved(true); }}
    onPointerUp={() => { dragging.current = false; }}>
    <div ref={container} className="map-canvas" role="region" aria-label={productT('mapLabel')} />
    <WeatherCanvasOverlay frame={displayedFrame} map={mapInstance}/>
    {!ready && <div className="map-loading" role="status">{productT('mapLoading')}</div>}
    <div className="grid-source" data-grid-variable={layer} data-grid-time={displayedFrame?.validAt} data-grid-state={gridError ?? (displayedFrame ? 'ready' : 'loading')}><strong>{t(`layers.${layer}` as never)}</strong>{displayedFrame && <span>{t(displayedFrame.sourceLabelKey as never)}</span>}{gridError && <span role="status">{gridError === 'unavailable' && layer === 'rain' ? mapT('rainGridUnavailable') : mapT('gridError')}</span>}{valueRange && <em>{valueRange.min.toFixed(1)}–{valueRange.max.toFixed(1)} {displayedFrame?.units}</em>}
      {displayedFrame && <div className={`grid-scale grid-scale-${displayedFrame.variable}`} aria-hidden="true"><i/><div>{legendTicks[displayedFrame.variable].map(value => <span key={value}>{value}</span>)}</div><small>{displayedFrame.units}</small></div>}
      {modelRun && <time dateTime={displayedFrame?.runAt}>{t('timeline.gridReference', {hour: Math.round((Date.parse(displayedFrame!.validAt) - Date.parse(displayedFrame!.runAt)) / 3_600_000), time: modelRun})}</time>}</div>
    <div className="map-attribution"><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">{'OpenFreeMap'}</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{'© OpenStreetMap'}</a></div>
  </div>;
}

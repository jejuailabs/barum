'use client';

import {useEffect, useRef} from 'react';
import type {Map as MapLibreMap} from 'maplibre-gl';
import type {GridFrame, GridVariable} from '@/types/domain';
import {sampleGrid} from '@/lib/grid/interpolate';

type Particle = {lng: number; lat: number; life: number};
type Rgba = [number, number, number, number];

const rampTokens: Record<GridVariable, string[]> = {
  wind: Array.from({length: 10}, (_, index) => `--weather-wind-${index}`),
  rain: Array.from({length: 8}, (_, index) => `--weather-rain-${index}`),
  temp: Array.from({length: 8}, (_, index) => `--weather-temp-${index}`),
  wave: Array.from({length: 8}, (_, index) => `--weather-wave-${index}`)
};

const rampStops: Record<GridVariable, number[]> = {
  wind: [0, 2.5, 5, 8, 10, 15, 20, 25, 31, 40],
  rain: [.08, .3, 1, 2, 5, 10, 20, 40],
  temp: [-30, -20, -10, 0, 10, 20, 30, 45],
  wave: [.05, .5, 1, 1.5, 2, 3.5, 6, 9]
};

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function parseHex(value: string): Rgba {
  const hex = value.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(part => part + part).join('') : hex;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
    full.length >= 8 ? Number.parseInt(full.slice(6, 8), 16) : 255
  ];
}

function mixRamp(ramp: Rgba[], position: number): Rgba {
  const scaled = Math.max(0, Math.min(1, position)) * (ramp.length - 1);
  const from = Math.floor(scaled);
  const to = Math.min(ramp.length - 1, from + 1);
  const fraction = scaled - from;
  return ramp[from].map((value, index) => Math.round(value + (ramp[to][index] - value) * fraction)) as Rgba;
}

function normalizedValue(frame: GridFrame, value: number) {
  const stops = rampStops[frame.variable];
  if (value <= stops[0]) return 0;
  if (value >= stops.at(-1)!) return 1;
  const upperIndex = stops.findIndex(stop => value < stop);
  const lowerIndex = upperIndex - 1;
  const fraction = (value - stops[lowerIndex]) / (stops[upperIndex] - stops[lowerIndex]);
  return (lowerIndex + fraction) / (stops.length - 1);
}

function fieldOpacity(frame: GridFrame, value: number) {
  if (frame.variable === 'rain') return value < .08 ? 0 : Math.min(.86, .38 + normalizedValue(frame, value) * .48);
  if (frame.variable === 'wave') return value < .05 ? 0 : Math.min(.82, .62 + normalizedValue(frame, value) * .2);
  if (frame.variable === 'wind') return .72;
  return .7;
}

function coordinateNoise(x: number, y: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function resetParticle(particle: Particle, frame: GridFrame, map: MapLibreMap) {
  const visible = map.getBounds();
  const west = Math.max(frame.bounds.west, visible.getWest());
  const east = Math.min(frame.bounds.east, visible.getEast());
  const south = Math.max(frame.bounds.south, visible.getSouth());
  const north = Math.min(frame.bounds.north, visible.getNorth());
  const usable = west < east && south < north;
  particle.lng = (usable ? west : frame.bounds.west) + Math.random() * ((usable ? east : frame.bounds.east) - (usable ? west : frame.bounds.west));
  particle.lat = (usable ? south : frame.bounds.south) + Math.random() * ((usable ? north : frame.bounds.north) - (usable ? south : frame.bounds.south));
  particle.life = 35 + Math.random() * 80;
}

export function WeatherCanvasOverlay({frame, map}: {frame: GridFrame | null; map: MapLibreMap | null}) {
  const fieldRef = useRef<HTMLCanvasElement>(null);
  const flowRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const waterMaskRef = useRef<{key: string; canvas: HTMLCanvasElement; scale: number} | null>(null);

  useEffect(() => {
    const fieldCanvas = fieldRef.current;
    const flowCanvas = flowRef.current;
    if (!fieldCanvas || !flowCanvas || !frame || !map) return;
    const fieldContext = fieldCanvas.getContext('2d');
    const flowContext = flowCanvas.getContext('2d');
    if (!fieldContext || !flowContext) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = Boolean((navigator as Navigator & {connection?: {saveData?: boolean}}).connection?.saveData);
    let animation = 0;
    let last = performance.now();
    let moving = false;
    let active = true;

    function resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
      const ratio = Math.min(2, devicePixelRatio || 1);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
    }

    function waterLayerIds() {
      return (map!.getStyle().layers ?? []).filter(layer => {
        const sourceLayer = (layer as typeof layer & {'source-layer'?: string})['source-layer'];
        return layer.type === 'fill' && (layer.id.toLowerCase().includes('water') || sourceLayer === 'water');
      }).map(layer => layer.id);
    }

    function getWaterMask(width: number, height: number) {
      const layerIds = waterLayerIds();
      if (layerIds.length === 0) return null;
      const center = map!.getCenter();
      const key = [width, height, center.lng.toFixed(4), center.lat.toFixed(4), map!.getZoom().toFixed(3)].join(':');
      let cached = waterMaskRef.current;
      if (!cached || cached.key !== key) {
        const scale = 48;
        const columns = Math.ceil(width / scale);
        const rows = Math.ceil(height / scale);
        const canvas = document.createElement('canvas');
        canvas.width = columns;
        canvas.height = rows;
        const context = canvas.getContext('2d');
        if (!context) return null;
        const image = context.createImageData(columns, rows);
        for (let y = 0; y < rows; y += 1) for (let x = 0; x < columns; x += 1) {
          if (map!.queryRenderedFeatures([(x + .5) * scale, (y + .5) * scale], {layers: layerIds}).length === 0) continue;
          const offset = (y * columns + x) * 4;
          image.data[offset] = 255;
          image.data[offset + 1] = 255;
          image.data[offset + 2] = 255;
          image.data[offset + 3] = 255;
        }
        context.putImageData(image, 0, 0);
        cached = {key, canvas, scale};
        waterMaskRef.current = cached;
      }
      return cached;
    }

    function applyWaterMask(width: number, height: number) {
      const mask = getWaterMask(width, height)?.canvas;
      if (!mask) return;
      fieldContext!.save();
      fieldContext!.globalCompositeOperation = 'destination-in';
      fieldContext!.imageSmoothingEnabled = true;
      fieldContext!.imageSmoothingQuality = 'high';
      fieldContext!.drawImage(mask, 0, 0, width, height);
      fieldContext!.restore();
    }

    function drawField() {
      resizeCanvas(fieldCanvas!, fieldContext!);
      resizeCanvas(flowCanvas!, flowContext!);
      const width = fieldCanvas!.clientWidth;
      const height = fieldCanvas!.clientHeight;
      fieldContext!.clearRect(0, 0, width, height);

      const sampleScale = innerWidth < 768 ? 3 : frame!.variable === 'wave' ? 5 : 4;
      const rasterWidth = Math.max(1, Math.ceil(width / sampleScale));
      const rasterHeight = Math.max(1, Math.ceil(height / sampleScale));
      const raster = document.createElement('canvas');
      raster.width = rasterWidth;
      raster.height = rasterHeight;
      const rasterContext = raster.getContext('2d');
      if (!rasterContext) return;
      const image = rasterContext.createImageData(rasterWidth, rasterHeight);
      const ramp = rampTokens[frame!.variable].map(name => parseHex(token(name)));
      const middleY = height / 2;
      const middleX = width / 2;
      const longitudes = Array.from({length: rasterWidth}, (_, x) => map!.unproject([(x + .5) * sampleScale, middleY]).lng);
      const latitudes = Array.from({length: rasterHeight}, (_, y) => map!.unproject([middleX, (y + .5) * sampleScale]).lat);

      for (let y = 0; y < rasterHeight; y += 1) {
        const lat = latitudes[y];
        if (lat < frame!.bounds.south || lat > frame!.bounds.north) continue;
        for (let x = 0; x < rasterWidth; x += 1) {
          const lng = longitudes[x];
          if (lng < frame!.bounds.west || lng > frame!.bounds.east) continue;
          const value = sampleGrid(frame!, lng, lat);
          const alpha = fieldOpacity(frame!, value);
          if (alpha === 0) continue;
          const color = mixRamp(ramp, normalizedValue(frame!, value));
          const offset = (y * rasterWidth + x) * 4;
          image.data[offset] = color[0];
          image.data[offset + 1] = color[1];
          image.data[offset + 2] = color[2];
          image.data[offset + 3] = Math.round(255 * alpha);
        }
      }
      rasterContext.putImageData(image, 0, 0);
      fieldContext!.imageSmoothingEnabled = true;
      fieldContext!.imageSmoothingQuality = 'high';
      fieldContext!.drawImage(raster, 0, 0, width, height);
      if (frame!.variable === 'wave') applyWaterMask(width, height);
    }

    function resetFlow() {
      resizeCanvas(flowCanvas!, flowContext!);
      flowContext!.clearRect(0, 0, flowCanvas!.clientWidth, flowCanvas!.clientHeight);
      const count = reduced || saveData ? 0 : innerWidth < 768 ? 360 : 720;
      particlesRef.current = Array.from({length: count}, () => ({lng: 0, lat: 0, life: 0}));
      particlesRef.current.forEach(particle => resetParticle(particle, frame!, map!));
    }

    function drawLayerTexture() {
      if (frame!.variable !== 'wave' && frame!.variable !== 'rain') return;
      const width = flowCanvas!.clientWidth;
      const height = flowCanvas!.clientHeight;
      const waterMask = frame!.variable === 'wave' ? getWaterMask(width, height) : null;
      const waterMaskContext = waterMask?.canvas.getContext('2d', {willReadFrequently: true});
      flowContext!.save();
      flowContext!.lineCap = 'round';
      for (let y = 28; y < height; y += frame!.variable === 'wave' ? 42 : 32) {
        for (let x = 24; x < width; x += frame!.variable === 'wave' ? 46 : 34) {
          const point = map!.unproject([x, y]);
          if (point.lng < frame!.bounds.west || point.lng > frame!.bounds.east || point.lat < frame!.bounds.south || point.lat > frame!.bounds.north) continue;
          if (waterMaskContext && waterMask && waterMaskContext.getImageData(Math.floor(x / waterMask.scale), Math.floor(y / waterMask.scale), 1, 1).data[3] === 0) continue;
          const value = sampleGrid(frame!, point.lng, point.lat);
          const noise = coordinateNoise(Math.round(point.lng * 10), Math.round(point.lat * 10));
          if (frame!.variable === 'wave') {
            if (value < .1 || noise < .24) continue;
            const angle = (noise - .5) * 1.5;
            const length = 5 + Math.min(8, value * 1.4);
            flowContext!.strokeStyle = token('--weather-flow-line');
            flowContext!.globalAlpha = .34 + Math.min(.28, value * .045);
            flowContext!.lineWidth = 1.15;
            flowContext!.beginPath();
            flowContext!.moveTo(x - Math.cos(angle) * length / 2, y - Math.sin(angle) * length / 2);
            flowContext!.quadraticCurveTo(x, y - 2.5, x + Math.cos(angle) * length / 2, y + Math.sin(angle) * length / 2);
            flowContext!.stroke();
          } else {
            if (value < .1) continue;
            if (value >= 2) {
              flowContext!.strokeStyle = token('--weather-lightning');
              flowContext!.shadowColor = token('--weather-lightning-glow');
              flowContext!.shadowBlur = 7;
              flowContext!.globalAlpha = Math.min(.95, .58 + value / 50);
              flowContext!.lineWidth = 1.7;
              flowContext!.beginPath();
              flowContext!.moveTo(x + 2, y - 8);
              flowContext!.lineTo(x - 2, y);
              flowContext!.lineTo(x + 1, y);
              flowContext!.lineTo(x - 3, y + 8);
              flowContext!.stroke();
            } else {
              flowContext!.strokeStyle = token('--weather-rain-streak');
              flowContext!.globalAlpha = .35 + Math.min(.35, value / 12);
              flowContext!.lineWidth = 1;
              flowContext!.beginPath();
              flowContext!.moveTo(x - 3, y - 5);
              flowContext!.lineTo(x + 1, y + 4);
              flowContext!.moveTo(x + 5, y - 3);
              flowContext!.lineTo(x + 8, y + 4);
              flowContext!.stroke();
            }
          }
        }
      }
      flowContext!.restore();
    }

    function drawFlow(now: number) {
      if (!active || frame!.variable !== 'wind' || particlesRef.current.length === 0 || document.hidden) return;
      const delta = Math.min(.035, (now - last) / 1000);
      last = now;
      const width = flowCanvas!.clientWidth;
      const height = flowCanvas!.clientHeight;
      flowContext!.globalCompositeOperation = 'destination-out';
      flowContext!.fillStyle = token('--weather-flow-fade');
      flowContext!.fillRect(0, 0, width, height);
      flowContext!.globalCompositeOperation = 'source-over';
      flowContext!.strokeStyle = token('--weather-flow-line');
      flowContext!.lineWidth = 1;
      flowContext!.globalAlpha = .68;
      flowContext!.beginPath();

      for (const particle of particlesRef.current) {
        const start = map!.project([particle.lng, particle.lat]);
        const u = sampleGrid(frame!, particle.lng, particle.lat, 'u');
        const v = sampleGrid(frame!, particle.lng, particle.lat, 'v');
        particle.lng += u * delta * .012;
        particle.lat += v * delta * .012;
        particle.life -= 1;
        const end = map!.project([particle.lng, particle.lat]);
        if (start.x >= 0 && start.x <= width && start.y >= 0 && start.y <= height) {
          flowContext!.moveTo(start.x, start.y);
          flowContext!.lineTo(end.x, end.y);
        }
        if (particle.lng < frame!.bounds.west || particle.lng > frame!.bounds.east || particle.lat < frame!.bounds.south || particle.lat > frame!.bounds.north || particle.life <= 0) resetParticle(particle, frame!, map!);
      }
      flowContext!.stroke();
      flowContext!.globalAlpha = 1;
      if (active && !moving) animation = requestAnimationFrame(drawFlow);
    }

    function refresh() {
      drawField();
      resetFlow();
      drawLayerTexture();
      cancelAnimationFrame(animation);
      if (frame!.variable === 'wind' && !moving) {
        last = performance.now();
        animation = requestAnimationFrame(drawFlow);
      }
    }

    function beginMove() {
      moving = true;
      cancelAnimationFrame(animation);
      fieldCanvas!.style.opacity = '0';
      fieldContext!.clearRect(0, 0, fieldCanvas!.clientWidth, fieldCanvas!.clientHeight);
      flowContext!.clearRect(0, 0, flowCanvas!.clientWidth, flowCanvas!.clientHeight);
    }

    function endMove() {
      moving = false;
      refresh();
      requestAnimationFrame(() => { if (active) fieldCanvas!.style.opacity = '1'; });
    }

    const observer = new ResizeObserver(refresh);
    observer.observe(fieldCanvas);
    map.on('movestart', beginMove);
    map.on('moveend', endMove);
    refresh();

    return () => {
      active = false;
      cancelAnimationFrame(animation);
      observer.disconnect();
      map.off('movestart', beginMove);
      map.off('moveend', endMove);
      fieldCanvas.style.opacity = '';
      fieldContext.clearRect(0, 0, fieldCanvas.clientWidth, fieldCanvas.clientHeight);
      flowContext.clearRect(0, 0, flowCanvas.clientWidth, flowCanvas.clientHeight);
    };
  }, [frame, map]);

  return <div className="weather-overlay" aria-hidden="true">
    <canvas ref={fieldRef} className="weather-field-canvas"/>
    <canvas ref={flowRef} className="weather-flow-canvas"/>
  </div>;
}

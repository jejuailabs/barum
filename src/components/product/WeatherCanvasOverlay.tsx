'use client';

import {useEffect, useRef} from 'react';
import type {Map as MapLibreMap} from 'maplibre-gl';
import type {GridFrame, GridVariable} from '@/types/domain';
import {sampleGrid} from '@/lib/grid/interpolate';

type Particle = {lng: number; lat: number; life: number};
type Rgba = [number, number, number, number];

const rampTokens: Record<GridVariable, string[]> = {
  wind: Array.from({length: 10}, (_, index) => `--weather-wind-${index}`),
  rain: Array.from({length: 6}, (_, index) => `--weather-rain-${index}`),
  temp: Array.from({length: 8}, (_, index) => `--weather-temp-${index}`),
  wave: Array.from({length: 7}, (_, index) => `--weather-wave-${index}`)
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
  if (frame.variable === 'wind') return value / 24;
  if (frame.variable === 'rain') return Math.log1p(Math.max(0, value)) / Math.log(21);
  if (frame.variable === 'temp') return (value + 8) / 44;
  return value / 3.5;
}

function fieldOpacity(frame: GridFrame, value: number) {
  if (frame.variable === 'rain') return value < .08 ? 0 : Math.min(.72, .28 + normalizedValue(frame, value) * .44);
  if (frame.variable === 'wave') return .58 + Math.max(0, Math.min(.08, normalizedValue(frame, value) * .08));
  return .6;
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

    function drawField() {
      resizeCanvas(fieldCanvas!, fieldContext!);
      resizeCanvas(flowCanvas!, flowContext!);
      const width = fieldCanvas!.clientWidth;
      const height = fieldCanvas!.clientHeight;
      fieldContext!.clearRect(0, 0, width, height);

      const sampleScale = innerWidth < 768 ? 3 : 4;
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
    }

    function resetFlow() {
      resizeCanvas(flowCanvas!, flowContext!);
      flowContext!.clearRect(0, 0, flowCanvas!.clientWidth, flowCanvas!.clientHeight);
      const count = reduced || saveData ? 0 : innerWidth < 768 ? 360 : 720;
      particlesRef.current = Array.from({length: count}, () => ({lng: 0, lat: 0, life: 0}));
      particlesRef.current.forEach(particle => resetParticle(particle, frame!, map!));
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

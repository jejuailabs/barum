'use client';

import {useEffect, useRef} from 'react';
import type {ImageSource, Map as MapLibreMap} from 'maplibre-gl';
import type {GridFrame} from '@/types/domain';
import {sampleGrid} from '@/lib/grid/interpolate';
import {rampStops, rasterizeGrid} from '@/lib/grid/raster';

const sourceId = 'barum-weather-field';
type Particle = {lng: number; lat: number; life: number};

export function WeatherCanvasOverlay({frame, map}: {frame: GridFrame | null; map: MapLibreMap | null}) {
  const flowRef = useRef<HTMLCanvasElement>(null);
  const currentFrame = useRef(frame);
  currentFrame.current = frame;

  useEffect(() => {
    if (!map) return;
    return () => {
      if (map.getLayer(sourceId)) map.removeLayer(sourceId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    if (!frame) {
      if (map.getLayer(sourceId)) map.removeLayer(sourceId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }
    function updateField() {
      const style = getComputedStyle(document.documentElement);
      const colors = rampStops[frame!.variable].map((_, i) => style.getPropertyValue(`--weather-${frame!.variable}-${i}`).trim());
      const raster = rasterizeGrid(frame!, colors);
      const image = new ImageData(raster.data, raster.width, raster.height);
      const {west, east, north, south} = frame!.bounds;
      const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [[west, north], [east, north], [east, south], [west, south]];
      if (!map!.getSource(sourceId)) map!.addSource(sourceId, {type: 'image', coordinates});
      (map!.getSource(sourceId) as ImageSource).updateImage({image, coordinates});
      if (!map!.getLayer(sourceId)) {
        const firstLabel = map!.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
        map!.addLayer({id: sourceId, type: 'raster', source: sourceId, paint: {'raster-fade-duration': 0, 'raster-resampling': 'linear'}}, firstLabel);
      }
    }
    updateField();
    const theme = new MutationObserver(updateField);
    theme.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    return () => theme.disconnect();
  }, [frame, map]);

  useEffect(() => {
    const canvas = flowRef.current;
    if (!canvas || !map) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & {connection?: EventTarget & {saveData?: boolean}}).connection;
    let particles: Particle[] = [];
    let animation = 0;
    let width = 1, height = 1, last = 0;
    let moving = false;
    let line = '', fade = '';
    let slowFrames = 0;
    const reset = (particle: Particle) => {
      const field = currentFrame.current;
      if (!field) return;
      const bounds = map.getBounds();
      const west = Math.max(field.bounds.west, bounds.getWest());
      const east = Math.min(field.bounds.east, bounds.getEast());
      const south = Math.max(field.bounds.south, bounds.getSouth());
      const north = Math.min(field.bounds.north, bounds.getNorth());
      particle.lng = west + Math.random() * Math.max(0, east - west);
      particle.lat = south + Math.random() * Math.max(0, north - south);
      particle.life = 40 + Math.random() * 80;
    };
    const clear = () => context.clearRect(0, 0, width, height);
    const draw = (now: number) => {
      animation = 0;
      const field = currentFrame.current;
      if (document.hidden || moving || motion.matches || connection?.saveData || field?.variable !== 'wind') return;
      const elapsed = now - last;
      if (elapsed < 16) { animation = requestAnimationFrame(draw); return; }
      slowFrames = elapsed > 28 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 30 && particles.length > 180) { particles.length = Math.max(180, Math.floor(particles.length * .75)); slowFrames = 0; }
      const delta = Math.min(.04, elapsed / 1000);
      last = now;
      context.globalCompositeOperation = 'destination-out';
      context.fillStyle = fade;
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = line;
      context.lineWidth = 1;
      context.beginPath();
      for (const particle of particles) {
        const start = map.project([particle.lng, particle.lat]);
        particle.lng += sampleGrid(field, particle.lng, particle.lat, 'u') * delta * .012;
        particle.lat += sampleGrid(field, particle.lng, particle.lat, 'v') * delta * .012;
        particle.life -= delta * 60;
        const end = map.project([particle.lng, particle.lat]);
        if (start.x >= 0 && start.x <= width && start.y >= 0 && start.y <= height) {
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
        } else particle.life = 0;
        if (particle.life <= 0) reset(particle);
      }
      context.stroke();
      animation = requestAnimationFrame(draw);
    };
    function refresh() {
      cancelAnimationFrame(animation);
      width = canvas!.clientWidth; height = canvas!.clientHeight;
      const ratio = Math.min(1.5, devicePixelRatio || 1, Math.sqrt(3_000_000 / Math.max(1, width * height)));
      canvas!.width = Math.max(1, Math.round(width * ratio));
      canvas!.height = Math.max(1, Math.round(height * ratio));
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      const style = getComputedStyle(document.documentElement);
      line = style.getPropertyValue('--weather-flow-line').trim();
      fade = style.getPropertyValue('--weather-flow-fade').trim();
      particles = Array.from({length: width < 768 || width * height > 3_000_000 ? 360 : 720}, () => ({lng: 0, lat: 0, life: 0}));
      particles.forEach(reset);
      last = performance.now();
      animation = requestAnimationFrame(draw);
    }
    const beginMove = () => { moving = true; cancelAnimationFrame(animation); clear(); };
    const endMove = () => { moving = false; refresh(); };
    const visibility = () => { if (document.hidden) cancelAnimationFrame(animation); else refresh(); };
    const observer = new ResizeObserver(refresh);
    observer.observe(canvas);
    const theme = new MutationObserver(refresh);
    theme.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    map.on('movestart', beginMove);
    map.on('moveend', endMove);
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', refresh);
    connection?.addEventListener('change', refresh);
    refresh();
    return () => {
      cancelAnimationFrame(animation); observer.disconnect(); theme.disconnect();
      map.off('movestart', beginMove); map.off('moveend', endMove);
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', refresh);
      connection?.removeEventListener('change', refresh);
      clear();
    };
  }, [map, frame?.variable]);

  return <div className="weather-overlay" aria-hidden="true" data-renderer="gpu-raster" data-field-visible={Boolean(frame)}><canvas ref={flowRef} className="weather-canvas weather-flow-canvas"/></div>;
}

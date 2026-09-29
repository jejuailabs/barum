'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {DailyPoint, Envelope, HourlyPoint, PhaseOneData, PointBundle, SourceMeta} from '@/types/domain';

interface PointResponse {data: PointBundle | null}

export function useLiveWeather(initial: PhaseOneData) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hourlyMeta, setHourlyMeta] = useState<SourceMeta | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const load = useCallback(async (lat: number, lng: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);
    const query = new URLSearchParams({lat: String(lat), lng: String(lng)});
    try {
      const [pointResponse, hourlyResponse, dailyResponse] = await Promise.all([
        fetch(`/api/v1/point?${query}`, {signal: controller.signal}),
        fetch(`/api/v1/forecast/hourly?${query}&h=48`, {signal: controller.signal}),
        fetch(`/api/v1/forecast/daily?${query}&d=15`, {signal: controller.signal})
      ]);
      if (!pointResponse.ok || !hourlyResponse.ok || !dailyResponse.ok) throw new Error('Weather request failed');
      const point = await pointResponse.json() as PointResponse;
      const hourly = await hourlyResponse.json() as Envelope<HourlyPoint[]>;
      const daily = await dailyResponse.json() as Envelope<DailyPoint[]>;
      if (point.data) {
        setData(previous => ({...previous, point: point.data!.point, marine: point.data!.marine, hourly: hourly.data, daily: daily.data,
          spot: {...previous.spot, lat, lng}}));
        setHourlyMeta(hourly.meta);
      }
    } catch (error) {
      if (!controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => { void load(initial.spot.lat, initial.spot.lng); return () => abortRef.current?.abort(); }, [initial.spot.lat, initial.spot.lng, load]);
  return {data, loading, error, hourlyMeta, selectLocation: load};
}

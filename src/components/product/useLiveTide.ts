'use client';

import {useEffect, useState} from 'react';
import type {Envelope, NormalizedTide} from '@/types/domain';
import {cacheTide, readCachedTide} from '@/lib/tide/offline';

export function useLiveTide(stationId: string, initial: Envelope<NormalizedTide>) {
  const [tide, setTide] = useState(initial);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const date = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date());
    const key = `${stationId}:${date}`;
    void (async () => {
      try {
        const response = await fetch(`/api/v1/tide/${stationId}?date=${date}`, {signal: controller.signal});
        if (!response.ok) throw new Error('Tide request failed');
        const value = await response.json() as Envelope<NormalizedTide>;
        setTide(value); setOffline(false);
        await cacheTide(key, value);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        const cached = await readCachedTide(key).catch(() => undefined);
        if (cached) { setTide({...cached, meta: {...cached.meta, state: 'stale'}, error: {code: 'STALE_DATA', messageKey: 'errors.offlineTide', retryable: true}}); setOffline(true); }
      }
    })();
    return () => controller.abort();
  }, [stationId]);
  return {tide, offline};
}

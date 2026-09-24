'use client';

import {useEffect, useState} from 'react';
import type {CctvRecord} from '@/types/domain';

export function useCctvRegistry(initial: CctvRecord[] = []) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(initial.length === 0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/cctv', {signal: controller.signal}).then(response => response.ok ? response.json() : Promise.reject())
      .then(result => setItems(result.data as CctvRecord[])).catch(() => undefined).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  return {items, loading};
}

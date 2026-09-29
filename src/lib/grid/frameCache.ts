import type {GridFrame, GridModel, GridVariable} from '@/types/domain';

export class GridUnavailableError extends Error {}

// Bound memory across model/layer changes; share requests while scrubbing.
export function createFrameCache(fetcher: typeof fetch = fetch, capacity = 12, ttl = 300_000) {
  const entries = new Map<string, {at: number; request: Promise<GridFrame>}>();
  return {
    get(variable: GridVariable, model: GridModel, step: number): Promise<GridFrame> {
      const key = `${model}:${variable}:${step}`;
      const cached = entries.get(key);
      if (cached && Date.now() - cached.at < ttl) {
        entries.delete(key);
        entries.set(key, cached);
        return cached.request;
      }
      const request = fetcher(`/api/v1/grid/${variable}?step=${step}&model=${model}`)
        .then(async response => {
          if (!response.ok) {
            const body = await response.json().catch(() => null) as {error?: {code?: string}} | null;
            if (body?.error?.code === 'GRID_UNAVAILABLE') throw new GridUnavailableError('Grid data unavailable');
            throw new Error('Grid request failed');
          }
          const {data} = await response.json() as {data: GridFrame | null};
          if (!data || data.variable !== variable || data.values.length !== data.width * data.height) throw new Error('Invalid grid frame');
          return data;
        }).catch(error => {
          if (entries.get(key)?.request === request) entries.delete(key);
          throw error;
        });
      entries.delete(key);
      entries.set(key, {at: Date.now(), request});
      while (entries.size > capacity) entries.delete(entries.keys().next().value!);
      return request;
    }
  };
}

export function forecastSteps(value: number) {
  const hours = Math.max(0, Math.min(100, value)) * 1.2;
  const from = Math.floor(hours / 3) * 3;
  const to = Math.min(120, from + 3);
  return {from, to, fraction: (hours - from) / Math.max(1, to - from)};
}

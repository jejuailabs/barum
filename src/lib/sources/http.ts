import {z} from 'zod';

type FetchLike = typeof fetch;
const circuit = new Map<string, {failures: number; openedAt?: number}>();

export async function fetchParsed<T>(url: string, schema: z.ZodType<T>, options: {fetcher?: FetchLike; timeoutMs?: number; attempts?: number; circuitKey: string}) {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const attempts = options.attempts ?? 3;
  const state = circuit.get(options.circuitKey);
  if (state?.openedAt && Date.now() - state.openedAt < 30_000) throw new Error(`Circuit open: ${options.circuitKey}`);
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetcher(url, {signal: AbortSignal.timeout(timeoutMs), next: {revalidate: 300}});
      if (!response.ok) throw new Error(`Upstream ${response.status}`);
      const parsed = schema.parse(await response.json());
      circuit.delete(options.circuitKey);
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
  const failures = (state?.failures ?? 0) + 1;
  circuit.set(options.circuitKey, {failures, openedAt: failures >= 3 ? Date.now() : undefined});
  throw lastError instanceof Error ? lastError : new Error('Upstream request failed');
}

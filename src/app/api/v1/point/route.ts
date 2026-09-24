import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSourceCacheStats} from '@/lib/sources/cache';
import {getWeatherBundle} from '@/lib/sources/weather';

export const runtime = 'nodejs';
const querySchema = z.object({lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180)});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({lat: url.searchParams.get('lat'), lng: url.searchParams.get('lng')});
  if (!parsed.success) return NextResponse.json({data: null, meta: null, error: {code: 'INVALID_REQUEST', messageKey: 'errors.invalidCoordinates', retryable: false}}, {status: 400});
  try {
    const result = await getWeatherBundle(parsed.data.lat, parsed.data.lng);
    const stats = getSourceCacheStats();
    return NextResponse.json({data: {point: result.value.point, marine: result.value.marine}, meta: result.value.point.meta, error: result.value.point.error},
      {headers: {'cache-control': 'public, s-maxage=300, stale-while-revalidate=600', 'x-barum-cache': result.status, 'x-barum-cache-hit-rate': stats.hitRate.toFixed(3)}});
  } catch {
    return NextResponse.json({data: null, meta: null, error: {code: 'UPSTREAM_UNAVAILABLE', messageKey: 'errors.weatherUnavailable', retryable: true}}, {status: 503});
  }
}

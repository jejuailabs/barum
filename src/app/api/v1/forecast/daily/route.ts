import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getWeatherBundle} from '@/lib/sources/weather';

export const runtime = 'nodejs';
const querySchema = z.object({lat: z.coerce.number().min(-90).max(90).default(33.4621), lng: z.coerce.number().min(-180).max(180).default(126.3092), d: z.coerce.number().int().min(1).max(15).default(15)});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({lat: url.searchParams.get('lat') ?? undefined, lng: url.searchParams.get('lng') ?? undefined, d: url.searchParams.get('d') ?? undefined});
  if (!parsed.success) return NextResponse.json({data: null, meta: null, error: {code: 'INVALID_REQUEST', messageKey: 'errors.invalidForecastRange', retryable: false}}, {status: 400});
  try {
    const result = await getWeatherBundle(parsed.data.lat, parsed.data.lng);
    return NextResponse.json({...result.value.daily, data: result.value.daily.data.slice(0, parsed.data.d)}, {headers: {'x-barum-cache': result.status, 'cache-control': 'public, s-maxage=2700, stale-while-revalidate=5400'}});
  } catch {
    return NextResponse.json({data: [], meta: null, error: {code: 'UPSTREAM_UNAVAILABLE', messageKey: 'errors.weatherUnavailable', retryable: true}}, {status: 503});
  }
}

import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getTideEnvelope} from '@/lib/sources/tide';

export const runtime = 'nodejs';
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(request: Request, {params}: {params: Promise<{stationId: string}>}) {
  const {stationId} = await params;
  const value = new URL(request.url).searchParams.get('date') ?? new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date());
  const parsed = dateSchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({data: null, meta: null, error: {code: 'INVALID_REQUEST', messageKey: 'errors.invalidDate', retryable: false}}, {status: 400});
  try {
    const result = await getTideEnvelope(stationId, parsed.data);
    return NextResponse.json(result.value, {headers: {'x-barum-cache': result.status, 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400'}});
  } catch {
    return NextResponse.json({data: null, meta: null, error: {code: 'UPSTREAM_UNAVAILABLE', messageKey: 'errors.tideUnavailable', retryable: true}}, {status: 503});
  }
}

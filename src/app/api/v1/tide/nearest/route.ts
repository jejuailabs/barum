import {NextResponse} from 'next/server';
import {z} from 'zod';
import {nearestTideStation} from '@/lib/tide/stations';

const schema = z.object({lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180)});
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({lat: url.searchParams.get('lat'), lng: url.searchParams.get('lng')});
  if (!parsed.success) return NextResponse.json({data: null, meta: null, error: {code: 'INVALID_REQUEST', messageKey: 'errors.invalidCoordinates', retryable: false}}, {status: 400});
  return NextResponse.json({data: nearestTideStation(parsed.data.lat, parsed.data.lng), meta: {source: 'BARUM_STATION_REGISTRY'}, error: null});
}

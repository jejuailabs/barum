import {NextResponse} from 'next/server';
import {getCctvRegistry} from '@/lib/sources/cctv/registry';

export const runtime = 'nodejs';

export async function GET() {
  const result = await getCctvRegistry();
  return NextResponse.json({data: result.value, meta: {source: 'FIRESTORE_CCTV', fetchedAt: new Date().toISOString()}, error: null},
    {headers: {'cache-control': 'public, s-maxage=300, stale-while-revalidate=600', 'x-barum-cache': result.status}});
}

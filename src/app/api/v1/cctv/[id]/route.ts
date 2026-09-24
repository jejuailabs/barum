import {NextResponse} from 'next/server';
import {getCctv} from '@/lib/sources/cctv/registry';

export const runtime = 'nodejs';

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const item = await getCctv(id);
  if (!item) return NextResponse.json({data: null, meta: null, error: {code: 'NOT_FOUND', messageKey: 'errors.cctvNotFound', retryable: false}}, {status: 404});
  return NextResponse.json({data: item, meta: {source: 'FIRESTORE_CCTV', fetchedAt: new Date().toISOString()}, error: null}, {headers: {'cache-control': 'public, s-maxage=300, stale-while-revalidate=600'}});
}

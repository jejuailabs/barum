import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createPreviewGrid} from '@/lib/sources/grid/preview';
import {loadLocalGrid} from '@/lib/sources/grid/live';

export const runtime = 'nodejs';

const paramsSchema = z.enum(['wind', 'rain', 'temp', 'wave']);
const querySchema = z.object({
  step: z.coerce.number().int().min(0).max(360).default(0),
  model: z.enum(['GFS', 'ECMWF', 'ICON']).default('GFS')
});

export async function GET(request: Request, {params}: {params: Promise<{variable: string}>}) {
  const variable = paramsSchema.safeParse((await params).variable);
  const search = new URL(request.url).searchParams;
  const query = querySchema.safeParse({step: search.get('step') ?? 0, model: (search.get('model') ?? 'GFS').toUpperCase()});
  if (!variable.success || !query.success) return NextResponse.json({data: null, meta: null, error: {code: 'INVALID_REQUEST', messageKey: 'errors.invalidGridRequest', retryable: false}}, {status: 400});
  const data = await loadLocalGrid(query.data.model, variable.data, query.data.step) ?? createPreviewGrid(variable.data, query.data.step, query.data.model);
  return NextResponse.json({data, meta: {source: data.model, requestedModel: query.data.model, sourceLabelKey: data.sourceLabelKey, issuedAt: data.runAt, fetchedAt: new Date().toISOString(), state: data.preview ? 'partial' : 'ready'}, error: null},
    {headers: {'cache-control': 'public, max-age=300, stale-while-revalidate=3600'}});
}

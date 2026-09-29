import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPreviewGrid} from '@/lib/sources/grid/preview';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/sources/grid/live', () => ({loadLocalGrid:vi.fn()}));

import {GET} from '@/app/api/v1/grid/[variable]/route';
import {loadLocalGrid} from '@/lib/sources/grid/live';

describe('grid API precipitation provenance', () => {
  beforeEach(() => vi.mocked(loadLocalGrid).mockReset().mockResolvedValue(null));

  it('does not serve synthetic diagonal rain as a forecast', async () => {
    expect(() => createPreviewGrid('rain', 0)).toThrow();
    const response = await GET(new Request('http://localhost/api/v1/grid/rain?model=GFS&step=0'), {params:Promise.resolve({variable:'rain'})});
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({data:null, error:{code:'GRID_UNAVAILABLE'}});
  });

  it('serves an actual rain grid when one is available', async () => {
    const frame = {...createPreviewGrid('wind', 0), variable:'rain' as const, model:'GFS' as const, preview:false as const, sourceLabelKey:'sources.gfsGrid', units:'mm/h'};
    vi.mocked(loadLocalGrid).mockResolvedValueOnce(frame);
    const response = await GET(new Request('http://localhost/api/v1/grid/rain?model=GFS&step=0'), {params:Promise.resolve({variable:'rain'})});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({data:{model:'GFS', preview:false, variable:'rain'}, meta:{state:'ready'}});
  });
});

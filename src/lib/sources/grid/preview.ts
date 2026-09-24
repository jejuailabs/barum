import type {GridFrame, GridModel, GridVariable} from '@/types/domain';

const bounds = {west: 108, south: 18, east: 148, north: 48};
const width = 161, height = 121;

export function createPreviewGrid(variable: GridVariable, stepHours: number, requestedModel: GridModel = 'GFS'): GridFrame {
  const values: number[] = [], u: number[] = [], v: number[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const modelPhase = requestedModel === 'ECMWF' ? .6 : requestedModel === 'ICON' ? 1.2 : 0;
    const phase = stepHours / 9 + x / 22 - y / 18 + modelPhase;
    const east = 3.5 + Math.sin(phase) * 2.4;
    const north = 1.4 + Math.cos(phase * .8) * 1.8;
    u.push(east); v.push(north);
    if (variable === 'wind') values.push(Math.hypot(east, north));
    if (variable === 'rain') values.push(Math.max(0, Math.sin(phase * 1.7) * 4));
    if (variable === 'temp') values.push(20 + Math.sin(phase * .65) * 5 - y * .12);
    if (variable === 'wave') values.push(.7 + Math.max(0, Math.cos(phase * .9)) * 1.4);
  }
  const run = new Date();
  run.setUTCMinutes(0, 0, 0);
  run.setUTCHours(Math.floor(run.getUTCHours() / 6) * 6);
  const runAt = run.toISOString();
  return {model: 'BARUM_POC', runAt, validAt: new Date(Date.parse(runAt) + stepHours * 3_600_000).toISOString(), variable,
    bounds, width, height, values, u: variable === 'wind' ? u : undefined, v: variable === 'wind' ? v : undefined,
    units: variable === 'wind' ? 'm/s' : variable === 'rain' ? 'mm/h' : variable === 'temp' ? '°C' : 'm',
    sourceLabelKey: `sources.${requestedModel.toLowerCase()}Preview`, preview: true};
}

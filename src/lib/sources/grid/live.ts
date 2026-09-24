import 'server-only';

import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import type {GridFrame, GridModel, GridVariable} from '@/types/domain';

const variableSchema = z.enum(['wind', 'rain', 'temp', 'wave']);
const frameSchema = z.object({
  model: z.enum(['GFS', 'ECMWF', 'ICON']),
  runAt: z.string(),
  validAt: z.string(),
  variable: variableSchema,
  bounds: z.object({west: z.number(), south: z.number(), east: z.number(), north: z.number()}),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  values: z.array(z.number()),
  u: z.array(z.number()).optional(),
  v: z.array(z.number()).optional(),
  units: z.string(),
  sourceLabelKey: z.string(),
  preview: z.literal(false)
}).superRefine((frame, context) => {
  const size = frame.width * frame.height;
  if (frame.values.length !== size) context.addIssue({code: 'custom', message: 'Grid value count mismatch'});
  if (frame.variable === 'wind' && (frame.u?.length !== size || frame.v?.length !== size)) context.addIssue({code: 'custom', message: 'Wind vector count mismatch'});
});

const manifestSchema = z.object({
  model: z.enum(['GFS', 'ECMWF', 'ICON']),
  runAt: z.string(),
  steps: z.array(z.number().int().min(0).max(360)),
  frames: z.object({
    wind: z.record(z.string(), z.string()).optional(),
    rain: z.record(z.string(), z.string()).optional(),
    temp: z.record(z.string(), z.string()).optional(),
    wave: z.record(z.string(), z.string()).optional()
  })
});

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function loadModelGrid(model: GridModel, variable: GridVariable, requestedStep: number): Promise<GridFrame | null> {
  try {
    const root = path.join(process.cwd(), 'data', 'grid');
    const modelRoot = path.join(root, model.toLowerCase());
    let manifestDir = modelRoot;
    let rawManifest: unknown;
    try {
      rawManifest = await readJson(path.join(modelRoot, 'latest.json'));
    } catch (error) {
      if (model !== 'GFS') throw error;
      manifestDir = root;
      rawManifest = await readJson(path.join(root, 'latest.json'));
    }
    const manifest = manifestSchema.parse(rawManifest);
    if (manifest.model !== model) return null;
    const candidates = Object.keys(manifest.frames[variable] ?? {}).map(Number).filter(Number.isFinite);
    if (!candidates.length) return null;
    const step = candidates.reduce((closest, value) => Math.abs(value - requestedStep) < Math.abs(closest - requestedStep) ? value : closest);
    const relativePath = manifest.frames[variable]?.[String(step)];
    if (!relativePath) return null;
    const absolutePath = path.resolve(manifestDir, relativePath);
    if (!absolutePath.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Grid manifest path escaped root');
    return frameSchema.parse(await readJson(absolutePath)) as GridFrame;
  } catch {
    return null;
  }
}

export async function loadLocalGrid(model: GridModel, variable: GridVariable, requestedStep: number): Promise<GridFrame | null> {
  const selected = await loadModelGrid(model, variable, requestedStep);
  if (selected) return selected;
  // Wave products are independent from atmospheric models. Until a model-specific
  // wave run is present, keep the field useful and label the NOAA source honestly.
  if (variable === 'wave' && model !== 'GFS') return loadModelGrid('GFS', variable, requestedStep);
  return null;
}

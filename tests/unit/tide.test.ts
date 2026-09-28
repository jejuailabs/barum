import {describe, expect, it, vi} from 'vitest';
import {describeTide, recommendedReturnAt, southSeaMulddae, tidePhase} from '../../src/lib/tide/calculate';
import {getTideStation, nearestTideStation} from '../../src/lib/tide/stations';
import {fetchKhoaTidePrediction, normalizeKhoaTide} from '../../src/lib/sources/khoa/tidePrediction';
import {fetchOpenMeteoTide, normalizeOpenMeteoTide} from '../../src/lib/sources/openmeteo/tide';

const station = getTideStation('aewol');
const date = '2026-09-23';
const khoaItems = [
  {obsvtrNm: 'Jeju', predcDt: `${date} 01:10`, predcTdlvVl: 38, extrSe: '2'},
  {obsvtrNm: 'Jeju', predcDt: `${date} 07:22`, predcTdlvVl: 214, extrSe: '1'},
  {obsvtrNm: 'Jeju', predcDt: `${date} 13:42`, predcTdlvVl: 31, extrSe: '4'},
  {obsvtrNm: 'Jeju', predcDt: `${date} 20:03`, predcTdlvVl: 221, extrSe: '3'}
];

describe('tide calculation', () => {
  it('calculates a stable south-sea tide number', () => {
    const result = southSeaMulddae(new Date(`${date}T12:00:00+09:00`));
    expect(result.number).toBeGreaterThanOrEqual(1);
    expect(result.number).toBeLessThanOrEqual(15);
    expect(result.label).toBe(String(result.number));
  });
  it('describes phase, next event, and safe return time', () => {
    const now = new Date(`${date}T10:00:00+09:00`);
    const tide = normalizeKhoaTide(khoaItems, station, date, now);
    expect(tidePhase(tide.series, now)).toBe('falling');
    const description = describeTide(tide, now);
    expect(description.nextEvent).toMatchObject({type: 'low', inMinutes: 222});
    expect(description.phaseKey).toBe('tideLive.phase.falling');
    expect(recommendedReturnAt(tide, now)).toEqual({at: `${date}T12:42:00.000+09:00`, remainingMinutes: 162});
  });
  it('selects the nearest pre-mapped station without interpolating tide', () => {
    expect(nearestTideStation(33.41, 126.26).spotId).toBe('hallim');
  });
});

describe('KHOA tide adapter', () => {
  it('normalizes official centimetres and high/low events', () => {
    const tide = normalizeKhoaTide(khoaItems, station, date, new Date(`${date}T09:00:00+09:00`));
    expect(tide.events[1]).toEqual({type: 'high', at: `${date}T07:22+09:00`, level: 2.14});
    expect(tide.series.length).toBe(145);
    expect(tide.observed).toBe(false);
  });
  it('validates and fetches a KHOA response', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({header: {resultCode: '00', resultMsg: 'NORMAL_SERVICE'}, body: {items: {item: khoaItems}}}))) as unknown as typeof fetch;
    const tide = await fetchKhoaTidePrediction(station, date, 'key', fetcher);
    expect(tide.events).toHaveLength(4);
  });
});

describe('model tide fallback', () => {
  const hourly = Array.from({length: 24}, (_, hour) => `${date}T${String(hour).padStart(2,'0')}:00`);
  const raw = {hourly: {time: hourly, sea_level_height_msl: hourly.map((_, index) => Math.sin(index * Math.PI / 6)),
    sea_surface_temperature: hourly.map(() => 24), ocean_current_velocity: hourly.map(() => 1), ocean_current_direction: hourly.map(() => 90)}};
  it('derives model events and current values with an explicit fallback source boundary', () => {
    const tide = normalizeOpenMeteoTide(raw, station, date, new Date(`${date}T09:10:00+09:00`));
    expect(tide.events.length).toBeGreaterThanOrEqual(3);
    expect(tide.seaTemperature).toBe(24);
  });
  it('fetches the marine model schema', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(raw))) as unknown as typeof fetch;
    expect((await fetchOpenMeteoTide(station, date, fetcher)).series).toHaveLength(24);
  });
});

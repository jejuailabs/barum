import type {NormalizedTide, TideDescription} from '@/types/domain';

const DAY_MS = 86_400_000;
const SYNODIC_DAYS = 29.530588;
const REFERENCE_NEW_MOON = Date.parse('2024-01-11T20:57:00+09:00');

export function southSeaMulddae(date: Date) {
  const moonAge = ((date.getTime() - REFERENCE_NEW_MOON) / DAY_MS % SYNODIC_DAYS + SYNODIC_DAYS) % SYNODIC_DAYS;
  const lunarIndex = Math.floor(moonAge) % 15;
  const number = (lunarIndex + 7) % 15 + 1;
  return {number, label: String(number), spring: [7, 8, 9].includes(number), neap: [14, 15, 1].includes(number)};
}

export function tidePhase(series: NormalizedTide['series'], now: Date): NormalizedTide['current']['phase'] {
  if (series.length < 2) return 'nearLow';
  const index = Math.max(0, series.findIndex(item => Date.parse(item.at) >= now.getTime()));
  const previous = series[Math.max(0, index - 1)];
  const next = series[Math.min(series.length - 1, index)];
  const delta = next.level - previous.level;
  const levels = series.map(item => item.level);
  const high = Math.max(...levels), low = Math.min(...levels);
  const tolerance = Math.max(.04, (high - low) * .08);
  if (next.level >= high - tolerance) return 'nearHigh';
  if (next.level <= low + tolerance) return 'nearLow';
  return delta > 0 ? 'rising' : 'falling';
}

export function describeTide(tide: NormalizedTide, now = new Date()): TideDescription {
  const next = tide.events.find(event => Date.parse(event.at) >= now.getTime()) ?? null;
  const phase = tidePhase(tide.series, now);
  const plainKey = tide.mulddae.spring ? 'tideLive.plainSpring' : tide.mulddae.neap ? 'tideLive.plainNeap' : 'tideLive.plainNormal';
  return {phase, phaseKey: `tideLive.phase.${phase}`, nextEvent: next ? {...next, inMinutes: Math.max(0, Math.round((Date.parse(next.at) - now.getTime()) / 60_000))} : null,
    mulddae: tide.mulddae, plainKey};
}

export function recommendedReturnAt(tide: NormalizedTide, now = new Date()) {
  const low = tide.events.find(event => event.type === 'low' && Date.parse(event.at) >= now.getTime());
  if (!low) return null;
  const at = new Date(Date.parse(low.at) - 60 * 60 * 1000);
  const seoul = new Date(at.getTime() + 9 * 60 * 60 * 1000).toISOString();
  return {at: `${seoul.slice(0, -1)}+09:00`, remainingMinutes: Math.round((at.getTime() - now.getTime()) / 60_000)};
}

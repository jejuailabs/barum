export type WeatherSource = 'KMA_ULTRA_NCST' | 'KMA_ASOS_AWS' | 'KMA_ULTRA_FCST' | 'KMA_SHORT_FCST' | 'KMA_MID_FCST' | 'OPEN_METEO' | 'ECMWF' | 'GFS';

export function isKoreanCoordinate(lat: number, lng: number) {
  return lat >= 32 && lat <= 39.5 && lng >= 124 && lng <= 132;
}

export function selectWeatherSources(leadTimeHours: number, isKorea: boolean): WeatherSource[] {
  if (!isKorea) return leadTimeHours <= 240 ? ['OPEN_METEO', 'ECMWF'] : ['ECMWF', 'GFS'];
  if (leadTimeHours <= 0) return ['KMA_ULTRA_NCST', 'KMA_ASOS_AWS', 'OPEN_METEO'];
  if (leadTimeHours <= 6) return ['KMA_ULTRA_FCST', 'KMA_SHORT_FCST', 'OPEN_METEO'];
  if (leadTimeHours <= 72) return ['KMA_SHORT_FCST', 'OPEN_METEO', 'ECMWF'];
  if (leadTimeHours <= 240) return ['KMA_MID_FCST', 'ECMWF', 'GFS'];
  return ['ECMWF', 'GFS'];
}

export async function firstAvailable<T>(sources: Array<{name: string; load: () => Promise<T>}>): Promise<{name: string; value: T; fallbackDepth: number}> {
  let lastError: unknown;
  for (let index = 0; index < sources.length; index += 1) {
    try {
      return {name: sources[index].name, value: await sources[index].load(), fallbackDepth: index};
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All weather sources failed');
}

import {z} from 'zod';
import type {DailyPoint, HourlyPoint, NormalizedPoint} from '@/types/domain';
import {fetchParsed} from '../http';

const numeric = z.number().nullable();
export const openMeteoForecastSchema = z.object({
  current: z.object({
    time: z.string(), temperature_2m: numeric, apparent_temperature: numeric,
    relative_humidity_2m: numeric, precipitation: numeric, rain: numeric, snowfall: numeric,
    weather_code: numeric, cloud_cover: numeric, pressure_msl: numeric, visibility: numeric,
    wind_speed_10m: numeric, wind_direction_10m: numeric, wind_gusts_10m: numeric
  }),
  hourly: z.object({
    time: z.array(z.string()), temperature_2m: z.array(numeric), apparent_temperature: z.array(numeric),
    precipitation_probability: z.array(numeric), precipitation: z.array(numeric), weather_code: z.array(numeric),
    wind_speed_10m: z.array(numeric), wind_direction_10m: z.array(numeric), uv_index: z.array(numeric)
  }),
  daily: z.object({
    time: z.array(z.string()), weather_code: z.array(numeric), temperature_2m_max: z.array(numeric),
    temperature_2m_min: z.array(numeric), precipitation_sum: z.array(numeric),
    precipitation_probability_max: z.array(numeric), wind_speed_10m_max: z.array(numeric),
    sunrise: z.array(z.string()), sunset: z.array(z.string())
  })
});

export type OpenMeteoForecastRaw = z.infer<typeof openMeteoForecastSchema>;

export function weatherCode(code: number | null) : NormalizedPoint['condition'] {
  if (code === null) return 'cloudy';
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 86) return 'shower';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}

export function seoulIso(value: string) {
  return /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}:00+09:00`;
}

function windVector(speed: number, direction: number) {
  const radians = direction * Math.PI / 180;
  return {u: Math.round(-speed * Math.sin(radians) * 100) / 100, v: Math.round(-speed * Math.cos(radians) * 100) / 100};
}

export function normalizeOpenMeteoForecast(raw: OpenMeteoForecastRaw, lat: number, lng: number) {
  const current = raw.current;
  const speed = current.wind_speed_10m ?? 0;
  const direction = current.wind_direction_10m ?? 0;
  const currentIndex = Math.max(0, raw.hourly.time.findIndex(time => time === current.time.slice(0, 13) + ':00'));
  const point: NormalizedPoint = {
    location: {lat, lng}, time: seoulIso(current.time), temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature, condition: weatherCode(current.weather_code),
    humidity: current.relative_humidity_2m, pressure: current.pressure_msl,
    visibility: current.visibility === null ? null : current.visibility / 1000,
    uvIndex: raw.hourly.uv_index[currentIndex] ?? null,
    wind: current.wind_speed_10m === null ? null : {speed, gust: current.wind_gusts_10m, direction, ...windVector(speed, direction)},
    precipitation: {amount: current.precipitation, probability: raw.hourly.precipitation_probability[currentIndex] ?? null,
      type: (current.snowfall ?? 0) > 0 ? 'snow' : (current.rain ?? 0) > 0 ? 'rain' : null},
    sky: {cloudCover: current.cloud_cover}
  };
  const hourly: HourlyPoint[] = raw.hourly.time.map((at, index) => ({
    at: seoulIso(at), condition: weatherCode(raw.hourly.weather_code[index] ?? null),
    temperature: raw.hourly.temperature_2m[index] ?? 0, windSpeed: raw.hourly.wind_speed_10m[index] ?? 0,
    windDirection: raw.hourly.wind_direction_10m[index] ?? 0
  }));
  const daily: DailyPoint[] = raw.daily.time.map((date, index) => ({
    date, condition: weatherCode(raw.daily.weather_code[index] ?? null),
    temperatureMin: raw.daily.temperature_2m_min[index] ?? null, temperatureMax: raw.daily.temperature_2m_max[index] ?? null,
    precipitationProbability: raw.daily.precipitation_probability_max[index] ?? null,
    precipitationAmount: raw.daily.precipitation_sum[index] ?? null, windSpeedMax: raw.daily.wind_speed_10m_max[index] ?? null,
    sunrise: raw.daily.sunrise[index] ? seoulIso(raw.daily.sunrise[index]) : null,
    sunset: raw.daily.sunset[index] ? seoulIso(raw.daily.sunset[index]) : null
  }));
  return {point, hourly, daily};
}

export async function fetchOpenMeteoForecast(lat: number, lng: number, fetcher?: typeof fetch) {
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lng), timezone: 'Asia/Seoul', wind_speed_unit: 'ms', forecast_days: '16',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,snowfall,weather_code,cloud_cover,pressure_msl,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset'
  });
  const raw = await fetchParsed(`https://api.open-meteo.com/v1/forecast?${params}`, openMeteoForecastSchema, {fetcher, circuitKey: 'open-meteo-weather'});
  return normalizeOpenMeteoForecast(raw, lat, lng);
}

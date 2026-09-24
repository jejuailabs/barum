export type Confidence = 'high' | 'medium' | 'diverging';
export type DataState = 'ready' | 'partial' | 'stale' | 'unavailable';
export type WxCode = 'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'shower' | 'fog' | 'thunder';

export interface SourceMeta {
  source: string;
  sourceLabelKey: string;
  issuedAt: string;
  fetchedAt: string;
  confidence: Confidence;
  station?: {id: string; name: string; distanceKm: number};
  cacheTtlSec: number;
  state: DataState;
}

export interface ApiError {
  code: 'UPSTREAM_UNAVAILABLE' | 'PARTIAL_DATA' | 'STALE_DATA';
  messageKey: string;
  retryable: boolean;
}

export interface Envelope<T> {data: T; meta: SourceMeta; error: ApiError | null}

export interface NormalizedPoint {
  location: {lat: number; lng: number; spotId?: string};
  time: string;
  temperature: number | null;
  feelsLike: number | null;
  condition: WxCode;
  humidity: number | null;
  pressure: number | null;
  visibility: number | null;
  uvIndex: number | null;
  wind: {speed: number; gust: number | null; direction: number; u: number; v: number} | null;
  precipitation: {amount: number | null; probability: number | null; type: 'rain' | 'snow' | 'mixed' | null};
  sky: {cloudCover: number | null};
}

export interface NormalizedMarine {
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  swellHeight: number | null;
  seaTemperature: number | null;
  current: {speed: number; direction: number} | null;
  ripCurrentRisk: 'low' | 'medium' | 'high' | null;
}

export interface NormalizedTide {
  stationId: string;
  stationName: string;
  distanceKm: number;
  tideSystem: 'south' | 'west';
  current: {level: number; phase: 'rising' | 'falling' | 'nearHigh' | 'nearLow'; at: string};
  events: Array<{type: 'high' | 'low'; at: string; level: number}>;
  series: Array<{at: string; level: number}>;
  mulddae: {number: number; label: string; spring: boolean; neap: boolean};
  sun: {rise: string; set: string};
  moon: {rise: string | null; set: string | null; phase: number};
  seaTemperature: number | null;
  observed: boolean;
}

export interface TideDescription {
  phase: NormalizedTide['current']['phase'];
  phaseKey: string;
  nextEvent: {type: 'high' | 'low'; at: string; inMinutes: number} | null;
  mulddae: NormalizedTide['mulddae'];
  plainKey: string;
}

export interface AdviceResult {
  activity: 'surf' | 'fishing' | 'drive' | 'cafe';
  level: 'good' | 'normal' | 'caution' | 'danger';
  titleKey: string;
  reasonKey: string;
  params: Record<string, string | number>;
  score: number;
  confidence: Confidence;
}

export interface HourlyPoint {
  at: string;
  condition: WxCode;
  temperature: number;
  windSpeed: number;
  windDirection: number;
}

export interface DailyPoint {
  date: string;
  condition: WxCode;
  temperatureMin: number | null;
  temperatureMax: number | null;
  precipitationProbability: number | null;
  precipitationAmount: number | null;
  windSpeedMax: number | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface PointBundle {
  point: Envelope<NormalizedPoint>;
  marine: Envelope<NormalizedMarine>;
}

export interface WeatherBundle extends PointBundle {
  hourly: Envelope<HourlyPoint[]>;
  daily: Envelope<DailyPoint[]>;
}

export interface Recommendation {
  id: string;
  category: AdviceResult['activity'];
  titleKey: string;
  descriptionKey: string;
  locationKey: string;
  metrics: Array<{labelKey: string; valueKey: string}>;
}

export type CctvStatus = 'online' | 'degraded' | 'offline';
export type GridVariable = 'wind' | 'rain' | 'temp' | 'wave';
export type GridModel = 'GFS' | 'ECMWF' | 'ICON';

export interface GridFrame {
  model: 'BARUM_POC' | GridModel;
  runAt: string;
  validAt: string;
  variable: GridVariable;
  bounds: {west: number; south: number; east: number; north: number};
  width: number;
  height: number;
  values: number[];
  u?: number[];
  v?: number[];
  units: string;
  sourceLabelKey: string;
  preview: boolean;
}

export interface CctvRecord {
  id: string;
  nameKey: string;
  lat: number;
  lng: number;
  hlsUrl?: string;
  backupHlsUrl?: string;
  thumbnailUrl?: string;
  thumbnailUpdatedAt?: string;
  providerKey: string;
  attributionKey: string;
  providerPageUrl: string;
  linkedSpotId?: string;
  tags: string[];
  status: CctvStatus;
  healthCheck: {lastOkAt: string | null; failCount: number; avgStartMs: number | null};
  enabled: boolean;
  sortOrder: number;
  rightsVerified: boolean;
  playbackMode: 'hls' | 'external';
}

export interface PhaseOneData {
  spot: {id: string; nameKey: string; addressKey: string; lat: number; lng: number; kind: 'beach' | 'rock' | 'mudflat' | 'harbor'};
  point: Envelope<NormalizedPoint>;
  marine: Envelope<NormalizedMarine>;
  tide: Envelope<NormalizedTide>;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  advice: AdviceResult[];
  recommendations: Recommendation[];
}

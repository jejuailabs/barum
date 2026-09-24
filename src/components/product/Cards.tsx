'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import type {AdviceResult, DailyPoint, HourlyPoint, NormalizedMarine, NormalizedPoint, NormalizedTide, Recommendation, SourceMeta} from '@/types/domain';
import {Icon, type IconName} from './Icon';
import {describeTide, recommendedReturnAt} from '@/lib/tide/calculate';
import {Link} from '@/i18n/navigation';

export function ConfidenceBadge({meta}: {meta: SourceMeta}) {
  const t = useTranslations();
  return <span className={`confidence confidence-${meta.confidence}`} title={t(meta.sourceLabelKey as never)}>
    <i aria-hidden="true"/>{t(`confidence.${meta.confidence}` as never)} · {t(meta.sourceLabelKey as never)} · {meta.issuedAt.slice(11, 16)}
  </span>;
}

export function WeatherGlyph({condition, size = 'large'}: {condition: NormalizedPoint['condition']; size?: 'small' | 'large'}) {
  return <span className={`weather-glyph ${size}`} aria-hidden="true">
    {condition === 'partly' && <><Icon name="sun"/><Icon name="cloud"/></>}
    {condition === 'clear' && <Icon name="sun"/>}
    {condition === 'cloudy' && <Icon name="cloud"/>}
    {(condition === 'rain' || condition === 'shower') && <Icon name="rain"/>}
  </span>;
}

export function CurrentWeatherCard({point}: {point: NormalizedPoint}) {
  const t = useTranslations();
  return <article className="weather-card panel-card">
    <div className="weather-primary"><WeatherGlyph condition={point.condition}/><strong>{point.temperature}°</strong></div>
    <div className="weather-condition"><h3>{t(`conditions.${point.condition}` as never)}</h3><p>{t('weather.feels', {value: point.feelsLike ?? 0})}</p></div>
    <div className="weather-advice"><span>{t('weather.summary')}</span></div>
  </article>;
}

export interface Metric {id: string; icon: IconName; label: string; value: string; tone?: string}
export function MetricCell({metric}: {metric: Metric}) {
  return <div className="metric-cell"><Icon name={metric.icon}/><div><span>{metric.label}</span><strong>{metric.value}</strong></div></div>;
}

export function MetricGrid({point, marine, compact = false}: {point: NormalizedPoint; marine: NormalizedMarine; compact?: boolean}) {
  const t = useTranslations();
  const metrics: Metric[] = [
    {id:'wind', icon:'wind', label:t('metrics.wind'), value:t('units.windValue', {value: point.wind?.speed ?? 0})},
    {id:'wave', icon:'wave', label:t('metrics.wave'), value:t('units.meterValue', {value: marine.waveHeight ?? 0})},
    {id:'rain', icon:'rain', label:t('metrics.rain'), value:t('units.percentValue', {value: point.precipitation.probability ?? 0})},
    {id:'sea', icon:'thermometer', label:t('metrics.seaTemp'), value:t('units.degreeValue', {value: marine.seaTemperature ?? 0})}
  ];
  return <div className={`metric-grid ${compact ? 'compact' : ''}`}>{metrics.map(metric => <MetricCell key={metric.id} metric={metric}/>)}</div>;
}

export function HourlyStrip({items}: {items: HourlyPoint[]}) {
  const t = useTranslations();
  return <section className="section-card panel-card"><div className="card-heading"><h3>{t('weather.hourly')}</h3></div>
    <div className="hourly-strip" tabIndex={0} aria-label={t('weather.hourly')}>{items.map((item, index) => <div key={item.at} className={index === 0 ? 'current' : ''}>
      <span>{index === 0 ? t('timeline.now') : item.at.slice(11, 16)}</span><WeatherGlyph condition={item.condition} size="small"/>
      <strong>{item.temperature}°</strong><small><span style={{transform:`rotate(${item.windDirection + 180}deg)`}}>↑</span> {item.windSpeed.toFixed(1)}</small>
    </div>)}</div>
  </section>;
}

export function DailyForecast({items}: {items: DailyPoint[]}) {
  const t = useTranslations();
  return <section className="section-card panel-card"><div className="card-heading"><h3>{t('weather.daily')}</h3></div>
    <div className="daily-strip" tabIndex={0} aria-label={t('weather.daily')}>{items.slice(0, 7).map(item => <div key={item.date}>
      <span>{item.date.slice(5).replace('-', '/')}</span><WeatherGlyph condition={item.condition} size="small"/>
      <strong>{t('weather.range', {min: item.temperatureMin ?? 0, max: item.temperatureMax ?? 0})}</strong>
      <small>{t('units.percentValue', {value: item.precipitationProbability ?? 0})}</small>
    </div>)}</div>
  </section>;
}

export function AdviceCard({advice}: {advice: AdviceResult}) {
  const t = useTranslations();
  const dynamicT = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const icon = advice.activity === 'surf' ? 'surf' : advice.activity === 'fishing' ? 'fish' : 'travel';
  return <article className={`advice-card advice-${advice.level}`}>
    <span className="advice-icon"><Icon name={icon}/></span><span><small>{dynamicT(`activities.${advice.activity}`)}</small><strong>{dynamicT(advice.titleKey, advice.params)}</strong><em>{dynamicT(advice.reasonKey, advice.params)}</em></span>
  </article>;
}

export function AdviceGrid({items}: {items: AdviceResult[]}) {
  const adviceT = useTranslations('advice');
  return <section className="advice-section"><h3>{adviceT('title')}</h3><div>{items.map(item => <AdviceCard key={item.activity} advice={item}/>)}</div></section>;
}

export function TideChart({tide}: {tide: NormalizedTide}) {
  const t = useTranslations();
  const levels = tide.series.map(item => item.level);
  const min = Math.min(...levels), max = Math.max(...levels), range = Math.max(.01, max - min);
  const points = tide.series.map((item, index) => `${index / Math.max(1, tide.series.length - 1) * 100},${88 - (item.level - min) / range * 68}`).join(' ');
  const description = describeTide(tide);
  return <section className="tide-card panel-card">
    <div className="card-heading"><h3><Icon name="wave"/>{t('tide.today', {station: tide.stationName})}</h3><span className="countdown"><Icon name="clock" size={17}/>{description.nextEvent ? t('tideLive.eventCountdown', {event: t(`tide.${description.nextEvent.type}` as never), minutes: description.nextEvent.inMinutes}) : t('tideLive.noNextEvent')}</span></div>
    <div className="tide-chart" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="tideLine"><stop offset="0" stopColor="var(--tide-curve-start)"/><stop offset="1" stopColor="var(--tide-curve-end)"/></linearGradient><linearGradient id="tideArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent-soft)"/><stop offset="1" stopColor="transparent"/></linearGradient></defs>
        <polygon className="tide-area" points={`${points} 100,100 0,100`}/><polyline points={points}/>
        {tide.events.map(event => { const at = Date.parse(event.at); const start = Date.parse(tide.series[0]?.at ?? event.at); const end = Date.parse(tide.series.at(-1)?.at ?? event.at); return <circle key={event.at} cx={(at-start)/Math.max(1,end-start)*100} cy={88-(event.level-min)/range*68} r="2.2"/>; })}
      </svg>
      <div className="tide-y"><span>{'2.0m'}</span><span>{'1.0m'}</span><span>{'0.0m'}</span></div>
      <div className="tide-x"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
      <div className="tide-event-list">{tide.events.slice(0,4).map(event => <span key={event.at}>{t(`tide.${event.type}` as never)} <b>{event.at.slice(11,16)}</b></span>)}</div>
    </div>
    <table className="sr-only"><caption>{t('tide.tableCaption')}</caption><thead><tr><th>{t('tide.event')}</th><th>{t('tide.time')}</th><th>{t('tide.level')}</th></tr></thead><tbody>{tide.events.map(event=><tr key={event.at}><td>{t(`tide.${event.type}` as never)}</td><td>{event.at.slice(11,16)}</td><td>{event.level}{'m'}</td></tr>)}</tbody></table>
  </section>;
}

export function TideStrip({tide}: {tide: NormalizedTide}) {
  const t = useTranslations();
  const items: Metric[] = [
    {id:'cycle',icon:'tide',label:t('tide.cycle'),value:t('tide.cycleValue',{value:tide.mulddae.number})},
    {id:'rise',icon:'sun',label:t('tide.sunrise'),value:tide.sun.rise}, {id:'set',icon:'sun',label:t('tide.sunset'),value:tide.sun.set},
    {id:'moon',icon:'moon',label:t('tide.moonrise'),value:tide.moon.rise ?? '—'},
    {id:'sea',icon:'thermometer',label:t('metrics.seaTemp'),value:t('units.degreeValue',{value:tide.seaTemperature ?? 0})}
  ];
  return <div className="tide-strip">{items.map(metric => <MetricCell key={metric.id} metric={metric}/>)}</div>;
}

export function SafetyBanner({tide}: {tide?: NormalizedTide}) {
  const safetyT = useTranslations('safety');
  const recommendation = tide ? recommendedReturnAt(tide) : null;
  return <aside className="safety-banner"><Icon name="clock"/><div><strong>{safetyT('title')}</strong><p>{recommendation ? safetyT('returnBy', {time: recommendation.at.slice(11,16), minutes: recommendation.remainingMinutes}) : safetyT('description')}</p><small>{safetyT('disclaimer')}</small></div><a href="tel:122">{safetyT('call')}</a></aside>;
}

export function CctvCard() {
  const t = useTranslations();
  return <article className="cctv-card">
    <div className="cctv-scene" role="img" aria-label={t('cctv.previewLabel')}><span className="island"/><span className="shore"/></div>
    <div className="live-badge"><i aria-hidden="true"/><strong>{t('cctv.live')}</strong><span>{t('cctv.place')}</span></div>
    <Link href="/cctv" className="expand-button" aria-label={t('cctv.expand')}><Icon name="expand"/></Link>
    <Link href="/cctv" className="cctv-play" aria-label={t('cctv.play')}><Icon name="play" size={30}/></Link>
    <time>09:41:23</time><small>{t('cctv.source')}</small>
  </article>;
}

export function RecommendCard({item, index}: {item: Recommendation; index: number}) {
  const t = useTranslations();
  const [liked, setLiked] = useState(false);
  return <article className="recommend-card">
    <div className={`recommend-image scene-${index}`}><span><Icon name="pin" size={15}/>{t(item.locationKey as never)}</span></div>
    <div className="recommend-content"><div><h3>{t(item.titleKey as never)}</h3><button type="button" aria-label={t('travel.favorite')} aria-pressed={liked} onClick={()=>setLiked(value=>!value)}><Icon name={liked ? 'star' : 'heart'}/></button></div>
      <p>{t(item.descriptionKey as never)}</p><dl>{item.metrics.map(metric=><div key={metric.labelKey}><dt>{t(metric.labelKey as never)}</dt><dd>{t(metric.valueKey as never)}</dd></div>)}</dl>
      <Link href={item.category === 'fishing' ? '/cctv' : '/spot/aewol'} className={`recommend-cta cta-${item.category}`}>{t(`travel.cta.${item.category}` as never)}<Icon name="chevron" size={16}/></Link>
    </div>
  </article>;
}

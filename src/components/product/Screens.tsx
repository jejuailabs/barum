'use client';

import {useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {CctvRecord, GridModel, GridVariable, PhaseOneData} from '@/types/domain';
import {LanguageSwitcher} from '@/components/ui/LanguageSwitcher';
import {ThemeSwitcher} from '@/components/ui/ThemeSwitcher';
import {Icon} from './Icon';
import {MapStage} from './MapStage';
import {BottomSheet} from './BottomSheet';
import {BottomNav, LayerRail, LocationChip, MapTools, ModelSelector, SearchControl, TimelineSlider} from './Controls';
import {AdviceGrid, ConfidenceBadge, CctvCard, CurrentWeatherCard, DailyForecast, HourlyStrip, MetricGrid, RecommendCard, SafetyBanner, TideChart, TideStrip, WeatherGlyph} from './Cards';
import {useLiveWeather} from './useLiveWeather';
import {useLiveTide} from './useLiveTide';
import {describeTide} from '@/lib/tide/calculate';
import {CctvPlayer} from './CctvPlayer';
import {useCctvRegistry} from './useCctvRegistry';

function SkipLink() {
  const productT = useTranslations('product');
  return <a href="#main" className="skip-link">{productT('skip')}</a>;
}

function UtilityControls() {
  return <div className="utility-controls glass-control"><LanguageSwitcher/><ThemeSwitcher/></div>;
}

function SourceFooter({data}: {data: PhaseOneData}) {
  const t = useTranslations();
  const hasMock = [data.point.meta.source, data.marine.meta.source, data.tide.meta.source].some(source => source.startsWith('MOCK'));
  return <footer className="source-footer"><span>{t('sources.label')}</span><ConfidenceBadge meta={data.point.meta}/><ConfidenceBadge meta={data.marine.meta}/><ConfidenceBadge meta={data.tide.meta}/><small>{t(hasMock ? 'sources.mockNotice' : 'sources.liveNotice')}</small></footer>;
}

function SegmentedTabs({active, onChange}: {active: string; onChange: (value: string) => void}) {
  const tabT = useTranslations('tabs');
  return <div className="segmented-tabs" role="tablist" aria-label={tabT('label')}>
    {['current','hourly','weekly','cctv'].map(id => <button key={id} role="tab" aria-selected={active === id} className={active === id ? 'active' : ''} onClick={()=>onChange(id)}>{tabT(id as never)}</button>)}
  </div>;
}

function StatusDock({data}: {data: PhaseOneData}) {
  const t = useTranslations();
  return <Link href="/spot/aewol" className="status-dock glass-panel" aria-label={t('product.openDetail')}>
    <div className="status-weather"><WeatherGlyph condition={data.point.data.condition}/><span><small>{t('metrics.now')}</small><strong>{data.point.data.temperature}°</strong><em>{t(`conditions.${data.point.data.condition}` as never)}</em></span></div>
    <MetricGrid point={data.point.data} marine={data.marine.data} compact/>
    <ConfidenceBadge meta={data.point.meta}/>
  </Link>;
}

export function MapHome({data}: {data: PhaseOneData}) {
  const productT = useTranslations('product');
  const t = useTranslations();
  const live = useLiveWeather(data);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const pendingMoveRef = useRef<{lat: number; lng: number; zoom: number} | null>(null);
  const [layer, setLayer] = useState<GridVariable>('wind');
  const [model, setModel] = useState<GridModel>('GFS');
  const [timeValue, setTimeValue] = useState(0);
  const [locationLabel, setLocationLabel] = useState(t('places.aewol'));
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const notify = (message: string) => { setActionStatus(message); window.setTimeout(() => setActionStatus(null), 2400); };
  const moveTo = (lat: number, lng: number, zoom = 11, label?: string) => {
    if (mapRef.current) mapRef.current.flyTo({center:[lng, lat], zoom, duration:900});
    else pendingMoveRef.current = {lat, lng, zoom};
    if (label) setLocationLabel(label);
    live.selectLocation(lat, lng);
  };
  const locate = () => {
    if (!navigator.geolocation) { notify(t('product.locationUnavailable')); return; }
    navigator.geolocation.getCurrentPosition(position => { moveTo(position.coords.latitude, position.coords.longitude, 12); notify(t('product.locationUpdated')); }, () => notify(t('product.locationDenied')), {enableHighAccuracy:true, timeout:8000});
  };
  const search = (query: string) => {
    const candidates = [
      {label:t('places.aewol'), lat:33.4621, lng:126.3092},
      {label:t('cctv.registry.hyeopjae'), lat:33.3941, lng:126.2396},
      {label:t('cctv.registry.hamdeok'), lat:33.5434, lng:126.6697},
      {label:t('cctv.registry.seongsan'), lat:33.4622, lng:126.9368},
      {label:t('cctv.registry.jungmun'), lat:33.2451, lng:126.4115},
      {label:t('places.hongKong'), lat:22.3193, lng:114.1694},
      {label:t('places.shanghai'), lat:31.2304, lng:121.4737},
      {label:t('places.taipei'), lat:25.0330, lng:121.5654},
      {label:t('places.seoul'), lat:37.5665, lng:126.9780},
      {label:t('places.pyongyang'), lat:39.0392, lng:125.7625},
      {label:t('places.tokyo'), lat:35.6762, lng:139.6503},
      {label:t('places.sapporo'), lat:43.0618, lng:141.3545}
    ];
    const found = candidates.find(item => item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    if (!found) { notify(t('product.searchNotFound')); return; }
    moveTo(found.lat, found.lng, 8.8, found.label); notify(t('product.searchMoved', {place:found.label}));
  };
  const selectTime = (value: number) => {
    setTimeValue(value);
    const url = new URL(window.location.href);
    url.searchParams.set('at', new Date(Date.now() + value / 100 * 120 * 3_600_000).toISOString());
    window.history.replaceState(null, '', url);
  };
  return <main id="main" className="product-shell map-home"><SkipLink/><MapStage onLocationSelect={live.selectLocation} onMapReady={map => {
    mapRef.current = map;
    const pending = pendingMoveRef.current;
    if (pending) { map.flyTo({center:[pending.lng, pending.lat], zoom:pending.zoom, duration:900}); pendingMoveRef.current = null; }
  }} layer={layer} model={model} timeValue={timeValue}/>
    <div className="map-top"><SearchControl onSearch={search} onLocate={locate}/><UtilityControls/></div><div className="map-location"><LocationChip label={locationLabel} onClick={()=>moveTo(33.4621,126.3092,11,t('places.aewol'))}/></div>
    <LayerRail value={layer} onChange={setLayer}/><MapTools onLocate={locate} onZoomIn={()=>mapRef.current?.zoomIn()} onZoomOut={()=>mapRef.current?.zoomOut()}/><div className="map-dock"><StatusDock data={live.data}/><ModelSelector value={model} onChange={setModel}/><TimelineSlider value={timeValue} onChange={selectTime}/></div>
    {actionStatus && <div className="map-action-status" role="status">{actionStatus}</div>}
    <div className="mock-flag" data-live-loading={live.loading}>{productT(live.loading ? 'weatherLoading' : 'liveWeather')}</div><BottomNav/>
  </main>;
}

export function SpotScreen({data}: {data: PhaseOneData}) {
  const t = useTranslations();
  const live = useLiveWeather(data);
  const [activeTab, setActiveTab] = useState('current');
  const [favorite, setFavorite] = useState(false);
  return <main id="main" className="product-shell detail-screen"><SkipLink/><MapStage compact onLocationSelect={live.selectLocation}/>
    <div className="detail-map-header"><Link href="/" aria-label={t('common.back')}><Icon name="back"/></Link><h1>{t(live.data.spot.nameKey as never)}</h1></div>
    <LayerRail compact/>
    <BottomSheet label={t('spot.sheetLabel')}>
      <header className="spot-heading"><div><h2>{t(live.data.spot.nameKey as never)}</h2><p>{t(live.data.spot.addressKey as never)}</p></div><button type="button" aria-label={t('spot.favorite')} aria-pressed={favorite} onClick={()=>setFavorite(value=>!value)}><Icon name={favorite ? 'heart' : 'star'}/></button></header>
      <SegmentedTabs active={activeTab} onChange={setActiveTab}/><SafetyBanner tide={live.data.tide.data}/>
      {activeTab === 'current' && <><CurrentWeatherCard point={live.data.point.data}/><MetricGrid point={live.data.point.data} marine={live.data.marine.data}/><AdviceGrid items={live.data.advice}/><TideChart tide={live.data.tide.data}/></>}
      {activeTab === 'hourly' && <><HourlyStrip items={live.data.hourly}/><MetricGrid point={live.data.point.data} marine={live.data.marine.data}/></>}
      {activeTab === 'weekly' && <DailyForecast items={live.data.daily}/>} {activeTab === 'cctv' && <CctvCard/>}
      <SourceFooter data={live.data}/>
    </BottomSheet><BottomNav/>
  </main>;
}

function PageHeader({title, subtitle}: {title: string; subtitle?: string}) {
  const commonT = useTranslations('common');
  return <header className="page-header"><Link href="/" aria-label={commonT('back')}><Icon name="back"/></Link><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><UtilityControls/></header>;
}

export function TideScreen({data}: {data: PhaseOneData}) {
  const t = useTranslations();
  const [beginner, setBeginner] = useState(true);
  const live = useLiveTide(data.spot.id, data.tide);
  const currentData = {...data, tide: live.tide};
  const description = describeTide(live.tide.data);
  return <main id="main" className="content-screen tide-screen"><SkipLink/><PageHeader title={t('tide.pageTitle')} subtitle={t('tide.pageSubtitle')}/>
    <div className="content-wrap">{live.offline && <div className="offline-banner" role="status">{t('tideLive.offline')}</div>}<div className="place-status"><LocationChip live/><span>{t(data.spot.addressKey as never)}</span></div>
      <MetricGrid point={data.point.data} marine={data.marine.data} compact/><TideChart tide={live.tide.data}/><TideStrip tide={live.tide.data}/>
      <section className="tide-explainer panel-card"><h2>{t(description.phaseKey as never)}</h2>{description.nextEvent && <p>{t('tideLive.nextEvent', {event:t(`tide.${description.nextEvent.type}` as never), minutes:description.nextEvent.inMinutes})}</p>}<p>{t('tideLive.cycleNatural',{value:description.mulddae.number, plain:t(description.plainKey as never)})}</p><div className="glossary-links"><abbr title={t('glossary.mulddaeDescription')}>{t('glossary.mulddae')}</abbr><abbr title={t('glossary.springDescription')}>{t('glossary.spring')}</abbr><abbr title={t('glossary.neapDescription')}>{t('glossary.neap')}</abbr></div></section>
      <SafetyBanner tide={live.tide.data}/><section className="week-card panel-card"><div className="card-heading"><h2>{t('tide.week')}</h2><button type="button" aria-pressed={beginner} onClick={()=>setBeginner(value=>!value)}>{t(beginner ? 'tide.advancedMode' : 'tide.beginnerMode')}</button></div>{[0,1,2,3,4,5,6].map(day=><div key={day}><strong>{t('tide.day', {day: day + 22})}</strong><span>{t('tide.low')} 13:{51 + day}</span><span>{t('tide.high')} 20:{16 + day}</span><em>{beginner ? t('tide.beginnerSummary') : t('tide.cycleValue',{value:8+day})}</em></div>)}</section>
      <SourceFooter data={currentData}/></div><BottomNav/>
  </main>;
}

export function CctvScreen({data, initialCctv}: {data: PhaseOneData; initialCctv: CctvRecord[]}) {
  const t = useTranslations();
  const registry = useCctvRegistry(initialCctv);
  const [selectedId, setSelectedId] = useState(initialCctv[0]?.id ?? '');
  const [view, setView] = useState<'list' | 'map'>('list');
  const selected = registry.items.find(item => item.id === selectedId) ?? registry.items[0];
  const searchCctv = (query: string) => {
    const found = registry.items.find(item => t(item.nameKey as never).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    if (found) setSelectedId(found.id);
  };
  return <main id="main" className="content-screen cctv-screen"><SkipLink/><PageHeader title={t('cctv.pageTitle')} subtitle={t('cctv.pageSubtitle')}/>
    <div className="content-wrap"><div className="cctv-search"><SearchControl onSearch={searchCctv}/><div className="place-status"><LocationChip live/><span>{t(data.spot.addressKey as never)}</span></div></div>
      {selected && <><CctvPlayer item={selected}/><div className="cctv-detail-link"><Link href={`/cctv/${selected.id}`}>{t('cctv.openDetail')} <Icon name="chevron" size={16}/></Link></div></>}
      <MetricGrid point={data.point.data} marine={data.marine.data} compact/><TideChart tide={data.tide.data}/>
      <section className="nearby-section"><div className="card-heading"><h2>{t('cctv.nearby')}</h2><div className="view-toggle"><button type="button" aria-pressed={view === 'list'} onClick={()=>setView('list')}>{t('cctv.list')}</button><button type="button" aria-pressed={view === 'map'} onClick={()=>setView('map')}>{t('cctv.map')}</button></div></div>
        {view === 'map' ? <div className="cctv-map" aria-label={t('cctv.mapLabel')}>{registry.items.map(item => <button type="button" key={item.id} style={{left:`${(item.lng-126.2)/.8*84+8}%`, top:`${(33.6-item.lat)/.4*78+8}%`}} onClick={()=>setSelectedId(item.id)} aria-label={t(item.nameKey as never)}><Icon name="camera" size={16}/></button>)}</div>
          : <div className="nearby-grid">{registry.items.map((item,index)=><button type="button" key={item.id} onClick={()=>setSelectedId(item.id)} aria-pressed={item.id === selected?.id}><span className={`mini-scene scene-${index % 4}`}/><strong>{t(item.nameKey as never)}</strong><small><i className={`status-${item.status}`} aria-hidden="true"/>{t(`cctv.status.${item.status}` as never)}</small><em>{t(item.attributionKey as never)}</em></button>)}</div>}
        {registry.loading && <p role="status">{t('cctv.loading')}</p>}</section>
      <SourceFooter data={data}/></div><BottomNav/>
  </main>;
}

export function CctvDetailScreen({data, item}: {data: PhaseOneData; item: CctvRecord}) {
  const t = useTranslations();
  return <main id="main" className="content-screen cctv-detail-screen"><SkipLink/><PageHeader title={t(item.nameKey as never)} subtitle={t('cctv.detailSubtitle')}/><div className="content-wrap">
    <CctvPlayer item={item} detail/><MetricGrid point={data.point.data} marine={data.marine.data}/><TideChart tide={data.tide.data}/><SafetyBanner tide={data.tide.data}/><p className="cctv-legal">{t('cctv.legal')}</p>
  </div><BottomNav/></main>;
}

export function TravelScreen({data}: {data: PhaseOneData}) {
  const t = useTranslations();
  const [category, setCategory] = useState('surf');
  return <main id="main" className="content-screen travel-screen"><SkipLink/>
    <section className="travel-hero"><div className="travel-sky" aria-hidden="true"><i/><i/></div><UtilityControls/><LocationChip/><div><h1>{t('travel.title')}</h1><p>{t('travel.subtitle')}</p></div></section>
    <div className="content-wrap travel-content"><div className="category-chips" role="tablist" aria-label={t('travel.categories')}>{['surf','fishing','drive','cafe'].map(id=><button key={id} role="tab" aria-selected={category===id} className={category===id?'active':''} onClick={()=>setCategory(id)}>{t(`activities.${id}` as never)}</button>)}</div>
      <section className="recommend-list" aria-label={t('travel.recommendations')}>{data.recommendations.filter(item=>item.category===category).map((item,index)=><RecommendCard key={item.id} item={item} index={index}/>)}</section>
      <section className="cctv-banner"><Icon name="camera" size={32}/><div><h2>{t('travel.cctvTitle')}</h2><p>{t('travel.cctvDescription')}</p><span>{t('travel.beachCheck')}</span><span>{t('travel.waveCheck')}</span><span>{t('travel.weatherCheck')}</span></div><Link href="/cctv" aria-label={t('travel.openCctv')}><Icon name="play"/></Link></section>
      <section className="course-section"><div className="card-heading"><h2>{t('travel.courses')}</h2></div><div tabIndex={0} aria-label={t('travel.courses')}>{['halfDay','sunsetSpot','rainOkay'].map((id,index)=><article key={id} className={`course-card scene-${index}`}><span>{t(`travel.${id}` as never)}</span><strong>{t(`travel.course${index+1}` as never)}</strong></article>)}</div></section>
      <SourceFooter data={data}/></div><BottomNav/>
  </main>;
}

export function MoreScreen({data}: {data: PhaseOneData}) {
  const t = useTranslations();
  return <main id="main" className="content-screen more-screen"><SkipLink/><PageHeader title={t('more.title')} subtitle={t('more.subtitle')}/><div className="content-wrap">
    <section className="profile-card panel-card"><span><Icon name="wave"/></span><div><h2>{t('more.guest')}</h2><p>{t('more.guestDescription')}</p></div><Icon name="chevron"/></section>
    <nav className="more-list" aria-label={t('more.menu')}>{['myInfo','alerts','settings','glossary','safety','sources','notice','privacy'].map(id=><span className="more-row" key={id}><span>{t(`more.${id}` as never)}</span><small>{t('more.phaseSix')}</small></span>)}</nav><SourceFooter data={data}/></div><BottomNav/></main>;
}

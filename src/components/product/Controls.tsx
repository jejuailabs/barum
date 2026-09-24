'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link, usePathname} from '@/i18n/navigation';
import {Icon, type IconName} from './Icon';
import type {GridModel, GridVariable} from '@/types/domain';

export function SearchControl({onSearch, onLocate}: {onSearch?: (query: string) => void; onLocate?: () => void} = {}) {
  const productT = useTranslations('product');
  const [query, setQuery] = useState('');
  return <form className="search-control glass-control" onSubmit={event => {event.preventDefault(); if (query.trim()) onSearch?.(query.trim());}}>
    <Icon name="search"/><label className="sr-only" htmlFor="map-search">{productT('search')}</label>
    <input id="map-search" type="search" placeholder={productT('search')} value={query} onChange={event=>setQuery(event.target.value)} />
    {onLocate && <button type="button" aria-label={productT('locate')} onClick={onLocate}><Icon name="locate"/></button>}
  </form>;
}

const allLayers: Array<{id: string; icon: IconName}> = [
  {id: 'wind', icon: 'wind'}, {id: 'rain', icon: 'rain'}, {id: 'temp', icon: 'temp'},
  {id: 'wave', icon: 'wave'}, {id: 'tide', icon: 'tide'}
];

export function LayerRail({compact = false, value, onChange}: {compact?: boolean; value?: GridVariable; onChange?: (value: GridVariable) => void}) {
  const layerT = useTranslations('layers');
  const [localActive, setLocalActive] = useState<GridVariable>('wind');
  const active = value ?? localActive;
  const layers = compact ? allLayers.filter(item => ['wind', 'rain', 'wave'].includes(item.id)) : allLayers;
  return <div className="layer-rail" role="radiogroup" aria-label={layerT('label')}>
    {layers.map(layer => <button key={layer.id} type="button" role="radio" aria-checked={active === layer.id} disabled={layer.id === 'tide'}
      className={active === layer.id ? 'active' : ''} onClick={() => {const next = layer.id as GridVariable; setLocalActive(next); onChange?.(next);}}>
      <Icon name={layer.icon}/><span>{layerT(layer.id as never)}</span>
    </button>)}
  </div>;
}

const gridModels: GridModel[] = ['ECMWF', 'GFS', 'ICON'];

export function ModelSelector({value, onChange}: {value: GridModel; onChange: (value: GridModel) => void}) {
  const modelT = useTranslations('models');
  return <div className="model-selector glass-panel" role="radiogroup" aria-label={modelT('label')}>
    {gridModels.map(model => <button key={model} type="button" role="radio" aria-checked={value === model}
      className={value === model ? 'active' : ''} onClick={() => onChange(model)}>
      <strong>{modelT(`${model.toLowerCase()}.short` as never)}</strong><span>{modelT(`${model.toLowerCase()}.region` as never)}</span>
    </button>)}
  </div>;
}

const nav: Array<{id: string; href: string; icon: IconName}> = [
  {id: 'tide', href: '/tide/aewol', icon: 'tide'}, {id: 'cctv', href: '/cctv', icon: 'camera'},
  {id: 'home', href: '/', icon: 'wave'}, {id: 'travel', href: '/travel', icon: 'travel'},
  {id: 'more', href: '/more', icon: 'more'}
];

export function BottomNav() {
  const navT = useTranslations('nav');
  const pathname = usePathname();
  return <nav className="bottom-nav" aria-label={navT('label')}>
    {nav.map((item, index) => {
      const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href.split('/').slice(0, 2).join('/'));
      return <Link key={item.id} href={item.href} className={`${item.id === 'home' ? 'nav-home' : ''} ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
        <span className="nav-icon"><Icon name={item.icon} size={item.id === 'home' ? 30 : 24}/></span>
        <span>{navT(item.id as never)}</span>{index !== 4 && item.id !== 'home' && <i aria-hidden="true"/>}
      </Link>;
    })}
  </nav>;
}

export function MapTools({onLocate, onZoomIn, onZoomOut}: {onLocate?: () => void; onZoomIn?: () => void; onZoomOut?: () => void} = {}) {
  const productT = useTranslations('product');
  return <div className="map-tools glass-control">
    <button type="button" aria-label={productT('locate')} onClick={onLocate}><Icon name="locate"/></button>
    <button type="button" aria-label={productT('zoomIn')} onClick={onZoomIn}><Icon name="plus"/></button>
    <button type="button" aria-label={productT('zoomOut')} onClick={onZoomOut}><Icon name="minus"/></button>
  </div>;
}

export function LocationChip({live = false, onClick, label}: {live?: boolean; onClick?: () => void; label?: string}) {
  const productT = useTranslations('product');
  return <div className="location-row">
    {onClick ? <button type="button" className="location-chip glass-control" onClick={onClick}><Icon name="pin" size={20}/><span>{label ?? productT('aewol')}</span><Icon name="chevron" size={16}/></button>
      : <div className="location-chip glass-control"><Icon name="pin" size={20}/><span>{label ?? productT('aewol')}</span></div>}
    {live && <span className="live-chip"><i aria-hidden="true"/>{productT('live')}</span>}
  </div>;
}

export function TimelineSlider({value: controlledValue, onChange}: {value?: number; onChange?: (value: number) => void} = {}) {
  const timelineT = useTranslations('timeline');
  const [localValue, setLocalValue] = useState(0);
  const value = controlledValue ?? localValue;
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const next = value >= 100 ? 0 : Math.min(100, value + 1);
      setLocalValue(next); onChange?.(next);
    }, 400);
    return () => clearInterval(timer);
  }, [onChange, playing, value]);
  function update(next: number) { setLocalValue(next); onChange?.(next); }
  return <div className="timeline glass-panel">
    <button type="button" className="timeline-play" aria-label={playing ? timelineT('pause') : timelineT('play')} onClick={() => setPlaying(value => !value)}><Icon name={playing ? 'pause' : 'play'}/></button>
    <div className="timeline-main">
      <label className="sr-only" htmlFor="weather-time">{timelineT('label')}</label>
      <input id="weather-time" type="range" min="0" max="100" value={value} onChange={event => update(Number(event.target.value))}/>
      <div className="timeline-labels"><span>{timelineT('now')}</span><span>{timelineT('oneHour')}</span><span>{timelineT('threeHours')}</span><span>{timelineT('tonight')}</span><span>{timelineT('tomorrow')}</span><span>{timelineT('sevenDays')}</span><span>{timelineT('fifteenDays')}</span></div>
    </div>
  </div>;
}

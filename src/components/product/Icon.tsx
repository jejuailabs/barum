export type IconName = 'search' | 'locate' | 'wind' | 'rain' | 'temp' | 'wave' | 'tide' | 'camera' |
  'travel' | 'more' | 'play' | 'star' | 'heart' | 'back' | 'sun' | 'cloud' | 'fish' |
  'surf' | 'pin' | 'clock' | 'expand' | 'plus' | 'minus' | 'moon' | 'thermometer' | 'chevron' | 'close' | 'pause';

const paths: Record<IconName, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  locate: <><circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
  wind: <><path d="M3 8h11c3 0 3-4 0-4-2 0-3 1-3 2M3 12h16c3 0 3 4 0 4-2 0-3-1-3-2M3 16h8"/></>,
  rain: <><path d="M7 15a5 5 0 1 1 2-9 6 6 0 0 1 11 3 4 4 0 0 1-1 8H8"/><path d="m8 19-1 2m6-2-1 2m6-2-1 2"/></>,
  temp: <><path d="M10 14.8V5a2 2 0 1 1 4 0v9.8a4 4 0 1 1-4 0Z"/><path d="M12 9v8"/></>,
  wave: <><path d="M2 8c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 13c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 18c3-4 5 4 8 0s5 4 8 0 4 0 4 0"/></>,
  tide: <><path d="M3 12a9 9 0 1 0 18 0"/><path d="M3 12h18M12 3v18"/></>,
  camera: <><path d="M3 7h13v11H3zM16 10l5-3v11l-5-3"/></>,
  travel: <><path d="M5 8h14v12H5zM9 8V5h6v3M8 12v4m8-4v4M5 14h14"/></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
  play: <path d="m9 6 9 6-9 6Z"/>, star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>,
  heart: <path d="M20 8c0 6-8 11-8 11S4 14 4 8c0-5 6-6 8-2 2-4 8-3 8 2Z"/>, back: <path d="m15 5-7 7 7 7"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></>,
  cloud: <path d="M5 18h13a4 4 0 0 0 0-8 6 6 0 0 0-11-2 5 5 0 0 0-2 10Z"/>,
  fish: <><path d="M4 12c4-5 9-5 13 0-4 5-9 5-13 0Z"/><path d="m17 12 4-3v6Z"/><circle cx="8" cy="11" r=".7" fill="currentColor" stroke="none"/></>,
  surf: <><path d="M4 18c4-4 8 4 16-2M8 15l3-4 3 2 2-5M13 6h.01"/></>,
  pin: <><path d="M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  expand: <><path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5"/><path d="m4 9 5-5m6 0 5 5M4 15l5 5m6 0 5-5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, minus: <path d="M5 12h14"/>,
  moon: <path d="M20 15a8 8 0 0 1-11-11 9 9 0 1 0 11 11Z"/>, thermometer: <><path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0Z"/><path d="M12 10v7"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>, close: <path d="M6 6l12 12M18 6 6 18"/>, pause: <><path d="M9 6v12M15 6v12"/></>
};

export function Icon({name, size = 24}: {name: IconName; size?: number}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

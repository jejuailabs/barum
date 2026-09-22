import {getTranslations} from 'next-intl/server';
import {WIND_SCALE, TEMP_SCALE, RAIN_SCALE, WAVE_SCALE} from '@/lib/weather/colorScale';

const colors = ['bg-base', 'surface-1', 'surface-2', 'surface-3', 'surface-glass', 'accent',
  'text-primary', 'text-secondary', 'text-tertiary', 'text-inverse', 'text-on-accent', 'accent-hover',
  'accent-soft', 'border-subtle', 'border-strong', 'bg-map-scrim', 'success', 'warning', 'danger', 'info', 'drive', 'sunset'] as const;
const typography = [
  ['display-xl', 'text-display-xl'], ['display-l', 'text-display-l'], ['title-xl', 'text-title-xl'],
  ['title-l', 'text-title-l'], ['title-m', 'text-title-m'], ['title-s', 'text-title-s'],
  ['value-l', 'text-value-l'], ['value-m', 'text-value-m'], ['body-m', 'text-body-m'],
  ['body-s', 'text-body-s'], ['label-m', 'text-label-m'], ['label-s', 'text-label-s'], ['mono-s', 'text-mono-s']
] as const;

/** Render shared tokens as real DOM samples for theme and accessibility review. */
export async function TokenGallery({extended}: {extended: boolean}) {
  const t = await getTranslations('gallery');
  return <>
    <section className="section" aria-labelledby="colors-title">
      <div className="section-heading"><h2 id="colors-title">{t('colors')}</h2><p>{t('colorsDescription')}</p></div>
      <div className="swatches">{(extended ? colors : colors.slice(0, 6)).map(token => <div className="swatch" key={token}>
        <div className="swatch-color" style={{background: `var(--${token})`}} aria-hidden="true" /><code className="swatch-label">{`--${token}`}</code>
      </div>)}</div>
    </section>
    <section className="section" aria-labelledby="type-title">
      <div className="section-heading"><h2 id="type-title">{t('typography')}</h2><p>{t('typographyDescription')}</p></div>
      <div className="type-grid">{(extended ? typography : typography.slice(0, 2)).map(([name, className]) => <div className="type-sample" key={name}>
        <code className="type-label">{name}</code><p className={className}>{name.startsWith('value') || name.startsWith('mono') ? t('numbers') : t('sample')}</p>
      </div>)}</div>
    </section>
    {extended && <>
      <section className="section" aria-labelledby="geometry-title">
        <div className="section-heading"><h2 id="geometry-title">{t('geometry')}</h2></div>
        <div className="metrics-grid">
          <div className="metric-card"><h3>{t('spacing')}</h3>{[1, 2, 3, 4, 5, 6, 8, 10, 14].map(n => <div className="token-row" key={n}><code>{`--space-${n}`}</code><span>{`${n * 4}px`}</span></div>)}</div>
          <div className="metric-card"><h3>{t('radius')}</h3>{[['pill', 999], ['xl', 24], ['lg', 20], ['md', 16], ['sm', 12], ['xs', 8]].map(([name, n]) => <div className="token-row" key={name}><code>{`--r-${name}`}</code><span>{`${n}px`}</span></div>)}</div>
          <div className="metric-card"><h3>{t('motion')}</h3>{[['instant', 0], ['fast', 150], ['base', 250], ['slow', 400], ['sheet', 320], ['theme', 200]].map(([name, n]) => <div className="token-row" key={name}><code>{`--duration-${name}`}</code><span>{`${n}ms`}</span></div>)}</div>
        </div>
      </section>
      <section className="section" aria-labelledby="weather-title">
        <div className="section-heading"><h2 id="weather-title">{t('weather')}</h2><p>{t('weatherDescription')}</p></div>
        {([['wind', WIND_SCALE], ['temp', TEMP_SCALE], ['rain', RAIN_SCALE], ['wave', WAVE_SCALE]] as const).map(([key, scale]) => <div key={key}>
          <div className="token-row"><span>{t(key)}</span><span>{`${scale[0][0]} — ${scale[scale.length - 1][0]}`}</span></div>
          <div className="scale-bar" style={{background: `linear-gradient(to right, ${scale.map(([, token]) => `var(${token})`).join(', ')})`}} aria-hidden="true" />
        </div>)}
      </section>
    </>}
  </>;
}

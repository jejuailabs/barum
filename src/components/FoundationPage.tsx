import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {LanguageSwitcher} from '@/components/ui/LanguageSwitcher';
import {ThemeSwitcher} from '@/components/ui/ThemeSwitcher';
import {TokenGallery} from '@/components/TokenGallery';

/** A foundation review surface, without fabricated live weather readings. */
export async function FoundationPage({gallery = false}: {gallery?: boolean}) {
  const t = await getTranslations('foundation');
  const app = await getTranslations('app');
  const g = await getTranslations('gallery');
  return <div className="shell">
    <a href="#main" className="skip-link">{t('skip')}</a>
    <header className="site-header">
      <Link href="/" className="brand" aria-label={app('name')}>
        <svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M4 11c5-6 11 6 16 0s9 0 12 0M4 18c5-6 11 6 16 0s9 0 12 0M4 25c5-6 11 6 16 0s9 0 12 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
        {app('name')}
      </Link>
      <div className="controls"><LanguageSwitcher /><ThemeSwitcher /></div>
    </header>
    <main id="main">
      <section className="hero">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 className="whitespace-pre-line">{gallery ? g('title') : t('title')}</h1>
          <p className="description">{gallery ? g('description') : t('description')}</p>
          <Link className="button" href={gallery ? '/' : '/dev/gallery'}>{gallery ? t('home') : t('gallery')} <span aria-hidden="true" className="ml-4">↗</span></Link>
        </div>
        <aside className="foundation-card">
          <p className="eyebrow mb-4">{t('phase')}</p>
          <h2>{t('statusTitle')}</h2>
          <ul><li><span aria-hidden="true">01</span>{t('statusLanguage')}</li><li><span aria-hidden="true">02</span>{t('statusTheme')}</li><li><span aria-hidden="true">03</span>{t('statusData')}</li></ul>
        </aside>
      </section>
      <TokenGallery extended={gallery} />
    </main>
    <footer className="footer"><p>{t('notice')}</p><p>{t('footer')}</p></footer>
  </div>;
}

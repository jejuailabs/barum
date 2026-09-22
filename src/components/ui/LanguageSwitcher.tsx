'use client';

import {useLocale, useTranslations} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';
import {routing, type Locale} from '@/i18n/routing';
import {useTransition} from 'react';

/** Keep the current screen while changing locale through next-intl navigation. */
export function LanguageSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <label className="control-label">{t('label')}
    <select aria-label={t('label')} value={locale} disabled={pending} onChange={event => {
      const nextLocale = event.target.value as Locale;
      startTransition(() => router.replace(pathname, {locale: nextLocale}));
    }}>{routing.locales.map(value => <option key={value} value={value}>{t(value)}</option>)}</select>
  </label>;
}

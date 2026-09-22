'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {normalizeTheme, THEME_STORAGE_KEY, type ThemePreference} from '@/lib/theme';

/** Synchronize explicit and system theme preferences across tabs and OS changes. */
export function ThemeSwitcher() {
  const t = useTranslations('theme');
  const [preference, setPreference] = useState<ThemePreference>('system');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (value: ThemePreference) => {
      setPreference(value);
      const resolved = value === 'system' ? (media.matches ? 'dark' : 'light') : value;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    const sync = () => {
      try { apply(normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY))); }
      catch { apply('system'); }
    };
    const storage = (event: StorageEvent) => { if (event.key === THEME_STORAGE_KEY || event.key === null) sync(); };
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('storage', storage);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', storage); };
  }, []);
  function change(value: ThemePreference) {
    setPreference(value);
    try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* Session-only preference remains usable. */ }
    const resolved = value === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }
  return <label className="control-label">{t('label')}
    <select aria-label={t('label')} value={preference} onChange={event => change(normalizeTheme(event.target.value))}>
      <option value="system">{t('system')}</option><option value="dark">{t('dark')}</option><option value="light">{t('light')}</option>
    </select>
  </label>;
}

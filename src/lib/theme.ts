export const THEME_STORAGE_KEY = 'barum.theme';
export type ThemePreference = 'system' | 'light' | 'dark';

/** Treat invalid or inaccessible stored preferences as system mode. */
export function normalizeTheme(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Runs synchronously in head before the body can paint. No network or secrets. */
export const themeInitScript = `(function(){var p='system';try{var v=localStorage.getItem('barum.theme');if(v==='light'||v==='dark')p=v;}catch(e){}var t=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;})();`;

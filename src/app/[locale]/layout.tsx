import type {Metadata} from 'next';
import {hasLocale, NextIntlClientProvider} from 'next-intl';
import {getMessages, getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {themeInitScript} from '@/lib/theme';
import '../globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';

/** Generate the five public locale roots at build time. */
export function generateStaticParams() { return routing.locales.map(locale => ({locale})); }

/** Localize the document title without exposing untranslated metadata. */
export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({locale, namespace: 'app'});
  return {title: {default: t('name'), template: `%s · ${t('name')}`}, description: t('description')};
}

/** Own locale and theme at the document boundary; children default to server components. */
export default async function LocaleLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return <html lang={locale} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{__html: themeInitScript}} /><link rel="stylesheet" href={`/fonts/${locale}/font.css`} /></head>
    <body><NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider></body>
  </html>;
}

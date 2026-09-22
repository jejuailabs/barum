import {setRequestLocale} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {FoundationPage} from '@/components/FoundationPage';

/** Phase 0 landing page; Phase 1 replaces this with the map home. */
export default async function Home({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <FoundationPage />;
}

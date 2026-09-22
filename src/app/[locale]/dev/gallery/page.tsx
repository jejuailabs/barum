import {hasLocale} from 'next-intl';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {FoundationPage} from '@/components/FoundationPage';
import {parseEnv} from '@/env';

export const metadata = {robots: {index: false, follow: false}};

/** Permanent token review surface, retained when the product UI is implemented. */
export default async function Gallery({params}: {params: Promise<{locale: string}>}) {
  if (parseEnv(process.env).APP_ENV === 'production') notFound();
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <FoundationPage gallery />;
}

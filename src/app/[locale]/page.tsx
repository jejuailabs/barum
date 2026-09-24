import {setRequestLocale} from 'next-intl/server';
import {MapHome} from '@/components/product/Screens';
import {getPhaseOneData} from '@/lib/sources/mock';
import type {Locale} from '@/i18n/routing';

export default async function Home({params}: {params: Promise<{locale: Locale}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  return <MapHome data={getPhaseOneData()}/>;
}

import {setRequestLocale} from 'next-intl/server';
import {TravelScreen} from '@/components/product/Screens';
import {getPhaseOneData} from '@/lib/sources/mock';
import type {Locale} from '@/i18n/routing';

export default async function TravelPage({params}: {params: Promise<{locale: Locale}>}) {
  const {locale} = await params; setRequestLocale(locale);
  return <TravelScreen data={getPhaseOneData()}/>;
}

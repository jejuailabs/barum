import {setRequestLocale} from 'next-intl/server';
import {TideScreen} from '@/components/product/Screens';
import {getPhaseOneData} from '@/lib/sources/mock';
import type {Locale} from '@/i18n/routing';

export function generateStaticParams() { return [{stationId: 'aewol'}]; }
export default async function TidePage({params}: {params: Promise<{locale: Locale; stationId: string}>}) {
  const {locale} = await params; setRequestLocale(locale);
  return <TideScreen data={getPhaseOneData()}/>;
}

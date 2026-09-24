import {setRequestLocale} from 'next-intl/server';
import {SpotScreen} from '@/components/product/Screens';
import {getPhaseOneData} from '@/lib/sources/mock';
import type {Locale} from '@/i18n/routing';

export function generateStaticParams() { return [{spotId: 'aewol'}]; }
export default async function SpotPage({params}: {params: Promise<{locale: Locale; spotId: string}>}) {
  const {locale} = await params; setRequestLocale(locale);
  return <SpotScreen data={getPhaseOneData()}/>;
}

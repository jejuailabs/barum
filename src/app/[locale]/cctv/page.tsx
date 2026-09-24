import {setRequestLocale} from 'next-intl/server';
import {CctvScreen} from '@/components/product/Screens';
import {getPhaseOneData} from '@/lib/sources/mock';
import type {Locale} from '@/i18n/routing';
import {getCctvRegistry} from '@/lib/sources/cctv/registry';

export default async function CctvPage({params}: {params: Promise<{locale: Locale}>}) {
  const {locale} = await params; setRequestLocale(locale);
  const registry = await getCctvRegistry();
  return <CctvScreen data={getPhaseOneData()} initialCctv={registry.value}/>;
}

import {notFound} from 'next/navigation';
import {setRequestLocale} from 'next-intl/server';
import type {Locale} from '@/i18n/routing';
import {CctvDetailScreen} from '@/components/product/Screens';
import {getPhaseOneData} from '@/lib/sources/mock';
import {getCctv} from '@/lib/sources/cctv/registry';

export default async function CctvDetailPage({params}: {params: Promise<{locale: Locale; id: string}>}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  const item = await getCctv(id);
  if (!item) notFound();
  return <CctvDetailScreen data={getPhaseOneData()} item={item}/>;
}

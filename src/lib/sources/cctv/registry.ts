import 'server-only';
import {getFirestore} from 'firebase-admin/firestore';
import {getFirebaseAdmin} from '@/lib/firebase/admin';
import type {CctvRecord} from '@/types/domain';
import {withSourceCache} from '../cache';
import {cctvSeed} from './seed';

function isAuthorized(record: CctvRecord) {
  return record.enabled && (record.playbackMode === 'external' || (record.rightsVerified && Boolean(record.hlsUrl)));
}

async function readRegistry(): Promise<CctvRecord[]> {
  try {
    const snapshot = await Promise.race([
      getFirestore(getFirebaseAdmin()).collection('cctv').orderBy('sortOrder').get(),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('CCTV registry timeout')), 2_000))
    ]);
    if (snapshot.empty) return cctvSeed;
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as CctvRecord)).filter(isAuthorized);
  } catch {
    return cctvSeed;
  }
}

export async function getCctvRegistry(options: {includeOffline?: boolean} = {}) {
  const result = await withSourceCache('cctv:registry', 300, readRegistry);
  return {...result, value: result.value.filter(item => options.includeOffline || item.status !== 'offline')};
}

export async function getCctv(id: string) {
  const registry = await getCctvRegistry({includeOffline: true});
  return registry.value.find(item => item.id === id && isAuthorized(item)) ?? null;
}

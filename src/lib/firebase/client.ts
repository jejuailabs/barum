'use client';

import {getApps, initializeApp} from 'firebase/app';
import {connectAuthEmulator, getAuth} from 'firebase/auth';
import {connectFirestoreEmulator, getFirestore} from 'firebase/firestore';
import {connectStorageEmulator, getStorage} from 'firebase/storage';

let services: ReturnType<typeof initializeServices> | undefined;
function initializeServices() {
  const local = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'false';
  const app = getApps()[0] ?? initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'demo-key',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-barum.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-barum',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'demo-barum.appspot.com',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? 'demo-app'
  });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  if (local) {
    if (app.options.projectId !== 'demo-barum') throw new Error('Local emulators require demo-barum');
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
  return {app, auth, db, storage};
}
/** Initialize Firebase lazily so Phase 0 pages carry no Firebase client bundle. */
export function getFirebaseClient() {
  services ??= initializeServices();
  return services;
}

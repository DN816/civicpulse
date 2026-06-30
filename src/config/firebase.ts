/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';

function env(key: string): string {
  const raw = import.meta.env[key] as string | undefined;
  if (!raw) return '';
  return raw.replace(/^['"]|['"]$/g, '');
}

const DATABASE_ID = env('VITE_FIREBASE_DATABASE_ID') || '(default)';

const firebaseConfig = {
  apiKey: env('VITE_FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = DATABASE_ID && DATABASE_ID !== '(default)' ? getFirestore(app, DATABASE_ID) : getFirestore(app);
export const storage = getStorage(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      // Connection test failed — Firestore client is offline
    }
  }
}
testConnection();

let messagingInstance: Messaging | null = null;
isSupported()
  .then((supported) => {
    if (supported) {
      messagingInstance = getMessaging(app);
    }
  })
  .catch(() => {
    // Messaging not supported in this environment
  });

export const messaging = messagingInstance;
export default app;

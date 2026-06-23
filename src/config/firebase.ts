/// <reference types="vite/client" />
// src/config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

const DATABASE_ID = import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = DATABASE_ID && DATABASE_ID !== '(default)' ? getFirestore(app, DATABASE_ID) : getFirestore(app);
export const storage = getStorage(app);

// Test Firestore Connection on Boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Successfully connected to Firestore named database:', DATABASE_ID);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: client is offline.");
    } else {
      console.warn("Firestore test document fetch completed or connection is active:", error);
    }
  }
}
testConnection();

// Messaging might not be supported in all environments (e.g., standard iframes or Safari in some conditions)
let messagingInstance: any = null;
isSupported().then((supported) => {
  if (supported) {
    messagingInstance = getMessaging(app);
  }
}).catch(() => {
  // Gracefully ignore failure to initialize messaging
});

export const messaging = messagingInstance;
export default app;

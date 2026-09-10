import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const isFirebaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "your_api_key_here" &&
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) &&
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) &&
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) &&
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

function createFirebaseAuth(): Auth | null {
  if (typeof window === "undefined" || !isFirebaseConfigured) {
    return null;
  }

  const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getAuth(app);
}

// Firebase Auth is a browser-only dependency. Avoid initializing it while Next.js prerenders
// pages so builds do not require client-side Firebase credentials.
export const auth: Auth | null = createFirebaseAuth();

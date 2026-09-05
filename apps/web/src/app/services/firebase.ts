import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const apiKey =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_API_KEY : undefined) ||
  (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_API_KEY : undefined);

const authDomain =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN : undefined) ||
  (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN : undefined);

const projectId =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID : undefined) ||
  (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_PROJECT_ID : undefined);

const storageBucket =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET : undefined) ||
  (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET : undefined);

const messagingSenderId =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID : undefined) ||
  (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID : undefined);

const appId =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_APP_ID : undefined) ||
  (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_APP_ID : undefined);

const firebaseConfig = {
  apiKey: apiKey || "demo-api-key",
  authDomain: authDomain || "demo-app.firebaseapp.com",
  projectId: projectId || "demo-app",
  storageBucket: storageBucket || "demo-app.appspot.com",
  messagingSenderId: messagingSenderId || "1234567890",
  appId: appId || "1:1234567890:web:demo"
};

export const isFirebaseConfigured = Boolean(
  apiKey && apiKey !== "your_api_key_here" && apiKey !== "demo-api-key"
);

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth: Auth = getAuth(app);

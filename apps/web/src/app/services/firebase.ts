import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "";
const authDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
  process.env.VITE_FIREBASE_AUTH_DOMAIN ||
  "demo-app.firebaseapp.com";
const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  "demo-app";
const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  process.env.VITE_FIREBASE_STORAGE_BUCKET ||
  "demo-app.appspot.com";
const messagingSenderId =
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
  process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
  "1234567890";
const appId =
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
  process.env.VITE_FIREBASE_APP_ID ||
  "1:1234567890:web:demo";

const firebaseConfig = {
  apiKey: apiKey || "demo-api-key",
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId
};

export const isFirebaseConfigured = Boolean(apiKey && apiKey !== "your_api_key_here");

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth: Auth = getAuth(app);

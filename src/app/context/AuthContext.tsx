"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User
} from "firebase/auth";
import { auth } from "../services/firebase";

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const FIREBASE_CONFIGURATION_ERROR =
  "La autenticación no está configurada. Configure las variables NEXT_PUBLIC_FIREBASE_* e intente nuevamente.";

function getFirebaseAuth(): Auth {
  if (!auth) {
    throw new Error(FIREBASE_CONFIGURATION_ERROR);
  }

  return auth;
}

export function translateFirebaseError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "El correo electrónico o la contraseña son incorrectos.";
    case "auth/email-already-in-use":
      return "Ya existe una cuenta registrada con este correo electrónico.";
    case "auth/weak-password":
      return "La contraseña es muy débil. Debe tener al menos 6 caracteres.";
    case "auth/invalid-email":
      return "El formato del correo electrónico no es válido.";
    case "auth/user-disabled":
      return "Esta cuenta ha sido deshabilitada.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Intente nuevamente en unos minutos.";
    case "auth/network-request-failed":
      return "Error de conexión. Verifique su acceso a internet.";
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
    case "auth/invalid-api-key":
      return "La clave de API de Firebase no es válida. Configure NEXT_PUBLIC_FIREBASE_API_KEY en su archivo .env.";
    default:
      return "Ocurrió un error al autenticar. Por favor intente nuevamente.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        void (async () => {
          try {
            const token = await currentUser.getIdToken();
            await fetch("/api/user/session", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch {
            // Ignore background session sync failure
          }
        })();
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const firebaseAuth = getFirebaseAuth();

    try {
      await signInWithEmailAndPassword(firebaseAuth, email, pass);
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      throw new Error(translateFirebaseError(code));
    }
  };

  const signUp = async (email: string, pass: string) => {
    const firebaseAuth = getFirebaseAuth();

    try {
      await createUserWithEmailAndPassword(firebaseAuth, email, pass);
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      throw new Error(translateFirebaseError(code));
    }
  };

  const logout = async () => {
    const firebaseAuth = getFirebaseAuth();

    try {
      await signOut(firebaseAuth);
      await fetch("/api/user/session", { method: "DELETE" }).catch(() => null);
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      throw new Error(translateFirebaseError(code));
    }
  };

  const resetPassword = async (email: string) => {
    const firebaseAuth = getFirebaseAuth();

    try {
      await sendPasswordResetEmail(firebaseAuth, email);
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      throw new Error(translateFirebaseError(code));
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signUp, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser utilizado dentro de un AuthProvider");
  }
  return context;
}

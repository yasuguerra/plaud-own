import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from "firebase/auth";

export let auth: any = null;
export const googleProvider = new GoogleAuthProvider();

export async function initFirebase() {
  if (getApps().length > 0) {
    auth = getAuth(getApp());
    return auth;
  }

  try {
    const res = await fetch("/api/config");
    const config = await res.json();
    const app = initializeApp(config);
    auth = getAuth(app);
    return auth;
  } catch (e) {
    console.error("Failed to dynamically initialize Firebase Auth:", e);
    return null;
  }
}

export { signInWithPopup, signOut };
export type { User };

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCC6GlB-2cDk6elARO33JEhvUO6MAJBLZc",
  authDomain: "trivia-34f8c.firebaseapp.com",
  projectId: "trivia-34f8c",
  storageBucket: "trivia-34f8c.firebasestorage.app",
  messagingSenderId: "1009414906772",
  appId: "1:1009414906772:web:e070af9c99c4526e97a581"
};

// Initialize once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export only what we actually use
export const db = getFirestore(app);
export const storage = getStorage(app);
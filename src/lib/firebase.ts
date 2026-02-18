import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDXPdIz6luQY211vriDGuYUZBRg3BOYiU0",
  authDomain: "resparke-hub.firebaseapp.com",
  projectId: "resparke-hub",
  storageBucket: "resparke-hub.firebasestorage.app",
  messagingSenderId: "455257714848",
  appId: "1:455257714848:web:113ce280150580be6a99c5",
  measurementId: "G-8W5K2K07XD"
};

// Initialize once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// THE MOST IMPORTANT LINE:
export const db = getFirestore(app, "trivia"); 
export const storage = getStorage(app);
import * as admin from 'firebase-admin';

// Helper to load credentials from Env Var or individual fields
const getCredentials = () => {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (error) {
      console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_KEY:', error);
    }
  }
  
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PROJECT_ID) {
    return {
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      projectId: process.env.GOOGLE_PROJECT_ID,
    };
  }
  return undefined;
};

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const credentials = getCredentials();
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'resparke-hub.firebasestorage.app';
  
  admin.initializeApp({
    credential: credentials ? admin.credential.cert(credentials) : undefined,
    storageBucket,
  });
}

export const adminStorage = admin.storage();
export const adminDb = admin.firestore();
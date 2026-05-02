import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'health'));
    console.log('Firebase connection successful');
  } catch (error: any) {
    if (error.message?.includes('the client is offline')) {
      console.error("Firebase is offline. Check configuration.");
    }
  }
}
testConnection();

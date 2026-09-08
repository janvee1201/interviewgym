import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Ensure local persistence for mobile & desktop sessions
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Auth persistence setting error:', err);
});

// Initialize Firestore with specific database ID if provided
const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
export const db = databaseId && databaseId !== '(default)'
  ? getFirestore(app, databaseId)
  : getFirestore(app);

// Connection test per Firebase skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore connection: Client is offline or database initializing.');
    }
  }
}

testConnection();

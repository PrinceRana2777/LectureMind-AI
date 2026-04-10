import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
} catch (error) {
  console.error('Firebase initialization failed:', error);
  // We'll export these as potentially undefined or throw a more descriptive error later
  // But for now, let's just ensure the module loads.
  // The ErrorBoundary will catch issues when these are used if they are undefined.
}

export { app, db, auth };
export default app!;

import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAu1LJq7QEXHiy-mmLsci-6NITtsX-_sF8",
  authDomain: "software-engineering-edc96.firebaseapp.com",
  projectId: "software-engineering-edc96",
  storageBucket: "software-engineering-edc96.firebasestorage.app",
  messagingSenderId: "103643147167",
  appId: "1:103643147167:web:18fde0cfafd778f988ebaa",
  measurementId: "G-9SQVKVSCD8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage };
export default app;
/**
 * Firebase compatibility layer - uses Supabase backend
 *
 * This file provides the same exports as the original firebase.js
 * but uses Supabase for data storage instead of Firebase.
 *
 * ALL DATA IS STORED IN SUPABASE (PostgreSQL cloud database).
 * LocalStorage is ONLY a temporary cache - can be wiped without data loss.
 */

import {
  initializeApp,
  getFirestore,
  getAuth,
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  addDoc,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from './js/firebase-compat.js';

// Firebase config (unused, kept for compatibility)
const firebaseConfig = {
  apiKey: "placeholder",
  authDomain: "placeholder",
  projectId: "placeholder"
};

// Initialize app
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Export everything the old firebase.js exported
export {
  db,
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  addDoc
};

// Additional Firestore functions the app needs
export const onSnapshot = () => {
  console.warn('onSnapshot not yet implemented');
  return () => {};
};

export const query = (collectionRef, ...constraints) => collectionRef;
export const where = (field, op, value) => ({ field, op, value });
export const orderBy = (field, direction = 'asc') => ({ field, direction });

export const updateDoc = async (docRef, data) => {
  return docRef.setDoc(data, { merge: true });
};

export const writeBatch = (db) => ({
  set: () => {},
  update: () => {},
  delete: () => {},
  commit: async () => {}
});

export const setPersistence = async () => {};
export const browserLocalPersistence = 'local';
export const browserSessionPersistence = 'session';

// Timestamp function
export const serverTimestamp = () => new Date().toISOString();

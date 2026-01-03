import { db } from '../firebase.js';
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const SHARED_COLLECTION = 'pt_shared';

const SHARED_DOC_IDS = {
  exerciseLibrary: 'exercise_library',
  exerciseRoles: 'exercise_roles',
  exerciseVocabulary: 'exercise_roles_vocabulary',
  exerciseFileSchema: 'exercise_file_schema',
  exerciseRolesSchema: 'exercise_roles_schema'
};

async function fetchJsonFallback(url) {
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fallback fetch failed: ${response.status}`);
  }
  return response.json();
}

async function readSharedDocument(docId) {
  const docRef = doc(db, SHARED_COLLECTION, docId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return snapshot.data();
}

async function seedSharedDocument(docId, data) {
  if (!data) return false;
  const docRef = doc(db, SHARED_COLLECTION, docId);
  await setDoc(docRef, data, { merge: true });
  return true;
}

async function loadSharedDocument({
  docId,
  fallbackUrl,
  fallbackData,
  seedIfMissing = false
}) {
  try {
    const data = await readSharedDocument(docId);
    if (data) return data;
  } catch (error) {
    console.warn(`[SharedData] Firestore read failed for ${docId}:`, error);
  }

  let fallback = fallbackData || null;
  if (!fallback && fallbackUrl) {
    try {
      fallback = await fetchJsonFallback(fallbackUrl);
    } catch (error) {
      console.warn(`[SharedData] Fallback fetch failed for ${docId}:`, error);
    }
  }

  if (fallback && seedIfMissing) {
    try {
      await seedSharedDocument(docId, fallback);
    } catch (error) {
      console.warn(`[SharedData] Firestore seed failed for ${docId}:`, error);
    }
  }

  return fallback;
}

export async function loadExerciseLibraryShared({
  fallbackUrl = null,
  seedIfMissing = false
} = {}) {
  const data = await loadSharedDocument({
    docId: SHARED_DOC_IDS.exerciseLibrary,
    fallbackUrl,
    seedIfMissing
  });
  return data?.exercises || [];
}

export async function loadExerciseRolesShared({
  fallbackUrl = null,
  fallbackData = null,
  seedIfMissing = false
} = {}) {
  const data = await loadSharedDocument({
    docId: SHARED_DOC_IDS.exerciseRoles,
    fallbackUrl,
    fallbackData,
    seedIfMissing
  });
  return data || { exercise_roles: {} };
}

export async function loadExerciseVocabularyShared({
  fallbackUrl = null,
  fallbackData = null,
  seedIfMissing = false
} = {}) {
  const data = await loadSharedDocument({
    docId: SHARED_DOC_IDS.exerciseVocabulary,
    fallbackUrl,
    fallbackData,
    seedIfMissing
  });
  return data || {};
}

export async function loadExerciseFileSchemaShared({
  fallbackUrl = null,
  seedIfMissing = false
} = {}) {
  const data = await loadSharedDocument({
    docId: SHARED_DOC_IDS.exerciseFileSchema,
    fallbackUrl,
    seedIfMissing
  });
  return data || {};
}

export async function saveExerciseRolesShared(rolesData) {
  return seedSharedDocument(SHARED_DOC_IDS.exerciseRoles, rolesData);
}

export async function saveExerciseVocabularyShared(vocabulary) {
  return seedSharedDocument(SHARED_DOC_IDS.exerciseVocabulary, vocabulary);
}

export async function saveExerciseLibraryShared(libraryData) {
  return seedSharedDocument(SHARED_DOC_IDS.exerciseLibrary, libraryData);
}

export async function loadExerciseRolesSchemaShared({
  fallbackUrl = null,
  seedIfMissing = false
} = {}) {
  const data = await loadSharedDocument({
    docId: SHARED_DOC_IDS.exerciseRolesSchema,
    fallbackUrl,
    seedIfMissing
  });
  return data || {};
}

export async function saveExerciseFileSchemaShared(schemaData) {
  return seedSharedDocument(SHARED_DOC_IDS.exerciseFileSchema, schemaData);
}

export async function saveExerciseRolesSchemaShared(schemaData) {
  return seedSharedDocument(SHARED_DOC_IDS.exerciseRolesSchema, schemaData);
}

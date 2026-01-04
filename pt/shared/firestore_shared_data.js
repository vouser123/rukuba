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

function normalizeExerciseLibrary(data) {
  if (!data) return { exercises: [] };
  const exercises = Array.isArray(data.exercises) ? data.exercises : data;
  if (!Array.isArray(exercises)) return { exercises: [] };

  const normalized = exercises.map((ex) => {
    const canonicalName = ex.canonical_name || ex.name || ex.title || '';
    const equipmentRequired = Array.isArray(ex.equipment)
      ? ex.equipment
      : ex.equipment?.required || [];
    const equipmentOptional = ex.equipmentOptional
      || ex.equipment_optional
      || ex.equipment?.optional
      || [];

    const guidance = ex.guidance || {};

    const heatmapTags = (() => {
      if (Array.isArray(ex.tags?.heatmap)) return ex.tags.heatmap;
      if (typeof ex.anatomicRegions === 'string') {
        return ex.anatomicRegions.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [];
    })();

    const functionalTags = Array.isArray(ex.tags)
      ? ex.tags
      : Array.isArray(ex.tags?.functional)
        ? ex.tags.functional
        : [];

    const normalizedExercise = {
      id: ex.id || ex.exercise_id,
      canonical_name: canonicalName,
      pt_category: ex.pt_category || 'other',
      description: ex.description || '',
      primary_muscles: ex.primary_muscles || [],
      secondary_muscles: ex.secondary_muscles || [],
      pattern: ex.pattern || 'both',
      pattern_modifiers: ex.pattern_modifiers || [],
      equipment: {
        required: equipmentRequired,
        optional: equipmentOptional
      },
      form_parameters_required: ex.form_parameters_required || [],
      tags: {
        functional: functionalTags,
        format: ex.tags?.format || [],
        heatmap: heatmapTags
      },
      guidance: {
        external_cues: guidance.external_cues || [],
        motor_cues: guidance.motor_cues || [],
        compensation_warnings: guidance.compensation_warnings || [],
        safety_flags: guidance.safety_flags || []
      },
      lifecycle: ex.lifecycle || {
        status: ex.archived ? 'archived' : 'active',
        effective_start_date: null,
        effective_end_date: null
      },
      added_date: ex.added_date ?? null,
      updated_date: ex.updated_date ?? null,
      supersedes: ex.supersedes || [],
      superseded_by: ex.superseded_by ?? null,
      superseded_date: ex.superseded_date ?? null
    };

    if (ex.current) {
      normalizedExercise.current = ex.current;
    }

    return normalizedExercise;
  });

  return { exercises: normalized };
}

export async function loadExerciseLibraryShared({
  fallbackUrl = null,
  seedIfMissing = false
} = {}) {
  // Load Firestore first so we can detect missing IDs before falling back.
  let sharedData = null;
  let firestoreLoaded = false;
  try {
    sharedData = await readSharedDocument(SHARED_DOC_IDS.exerciseLibrary);
    firestoreLoaded = sharedData != null;
  } catch (error) {
    console.warn('[SharedData] Firestore read failed for exercise library:', error);
  }

  // Always fetch the fallback when provided so we can reconcile missing exercises.
  let fallbackData = null;
  if (fallbackUrl) {
    try {
      fallbackData = await fetchJsonFallback(fallbackUrl);
    } catch (error) {
      console.warn('[SharedData] Fallback fetch failed for exercise library:', error);
    }
  }

  const extractExercises = (data) => {
    if (!data) return [];
    if (Array.isArray(data.exercises)) return data.exercises;
    if (Array.isArray(data)) return data;
    return [];
  };

  const getExerciseId = (exercise) => exercise?.id || exercise?.exercise_id || null;

  const sharedExercises = extractExercises(sharedData);
  const fallbackExercises = extractExercises(fallbackData);

  const sharedIds = new Set(sharedExercises.map(getExerciseId).filter(Boolean));
  const missingExercises = fallbackExercises.filter((exercise) => {
    const id = getExerciseId(exercise);
    return !id || !sharedIds.has(id);
  });

  let mergedData = sharedData;
  let source = firestoreLoaded ? 'firestore' : 'unknown';
  if (sharedExercises.length === 0 && fallbackExercises.length > 0) {
    mergedData = fallbackData;
    source = 'fallback';
  } else if (missingExercises.length > 0) {
    console.warn(
      `[SharedData] Exercise library missing ${missingExercises.length} entries in Firestore; merging fallback data.`
    );
    const mergedExercises = [...sharedExercises, ...missingExercises];
    if (Array.isArray(sharedData)) {
      mergedData = mergedExercises;
    } else if (sharedData && Array.isArray(sharedData.exercises)) {
      mergedData = { ...sharedData, exercises: mergedExercises };
    } else {
      mergedData = { exercises: mergedExercises };
    }
    source = 'firestore+fallback';
  }

  // Seed Firestore if missing entirely, or if we detected missing exercises.
  if (seedIfMissing && (sharedData == null || missingExercises.length > 0)) {
    const payload = mergedData ?? fallbackData;
    if (payload) {
      try {
        await seedSharedDocument(SHARED_DOC_IDS.exerciseLibrary, payload);
      } catch (error) {
        console.warn('[SharedData] Firestore seed failed for exercise library:', error);
      }
    }
  }

  if (source.includes('fallback')) {
    console.warn(`[SharedData] Exercise library using ${source} source; Firestore is preferred.`);
  }

  try {
    localStorage.setItem('pt_shared_library_source', source);
  } catch (error) {
    console.warn('[SharedData] Failed to persist library source hint:', error);
  }

  return normalizeExerciseLibrary(mergedData ?? fallbackData).exercises;
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

export async function migrateSharedDosageToRuntime({
  userId,
  overwriteExisting = false,
  recordHistory = true
} = {}) {
  if (!userId) {
    throw new Error('User ID is required to migrate dosage.');
  }

  const shared = await readSharedDocument(SHARED_DOC_IDS.exerciseLibrary);
  const normalized = normalizeExerciseLibrary(shared).exercises;
  const dosageEntries = normalized.filter((exercise) => exercise.current?.sets);
  const dosageMap = new Map(dosageEntries.map((exercise) => [exercise.id, exercise.current]));

  if (dosageMap.size === 0) {
    return {
      total: 0,
      updated: 0,
      skipped: 0,
      skippedNoLibrary: 0
    };
  }

  const runtimeRef = doc(db, 'users', userId, 'pt_runtime', 'state');
  const runtimeSnapshot = await getDoc(runtimeRef);
  const runtimeData = runtimeSnapshot.exists() ? runtimeSnapshot.data() : {};
  const runtimeLibrary = Array.isArray(runtimeData.exerciseLibrary)
    ? runtimeData.exerciseLibrary
    : [];

  if (runtimeLibrary.length === 0) {
    return {
      total: dosageMap.size,
      updated: 0,
      skipped: 0,
      skippedNoLibrary: dosageMap.size
    };
  }

  let updated = 0;
  let skipped = 0;
  const updatedLibrary = runtimeLibrary.map((entry) => {
    const dosage = dosageMap.get(entry.id);
    if (!dosage) return entry;
    if (!overwriteExisting && entry.current?.sets) {
      skipped += 1;
      return entry;
    }
    const nextEntry = { ...entry, current: dosage };
    if (recordHistory) {
      const history = Array.isArray(nextEntry.history) ? [...nextEntry.history] : [];
      history.push({
        timestamp: new Date().toISOString(),
        summary: 'Migrated PT dosage from shared library',
        previous: entry.current || {},
        next: dosage,
        supersedes: []
      });
      nextEntry.history = history;
    }
    updated += 1;
    return nextEntry;
  });

  await setDoc(runtimeRef, {
    exerciseLibrary: updatedLibrary,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return {
    total: dosageMap.size,
    updated,
    skipped,
    skippedNoLibrary: 0
  };
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

export async function seedSharedFromJsonSources({
  exerciseLibraryUrl = 'exercise_library.json',
  exerciseRolesUrl = 'exercise_roles.json',
  exerciseVocabularyUrl = 'exercise_roles_vocabulary.json',
  exerciseFileSchemaUrl = 'schema/exercise_file.schema.json',
  exerciseRolesSchemaUrl = 'schema/exercise_roles.schema.json'
} = {}) {
  const [
    libraryData,
    rolesData,
    vocabularyData,
    fileSchemaData,
    rolesSchemaData
  ] = await Promise.all([
    fetchJsonFallback(exerciseLibraryUrl),
    fetchJsonFallback(exerciseRolesUrl),
    fetchJsonFallback(exerciseVocabularyUrl),
    fetchJsonFallback(exerciseFileSchemaUrl),
    fetchJsonFallback(exerciseRolesSchemaUrl)
  ]);

  await Promise.all([
    seedSharedDocument(SHARED_DOC_IDS.exerciseLibrary, libraryData),
    seedSharedDocument(SHARED_DOC_IDS.exerciseRoles, rolesData),
    seedSharedDocument(SHARED_DOC_IDS.exerciseVocabulary, vocabularyData),
    seedSharedDocument(SHARED_DOC_IDS.exerciseFileSchema, fileSchemaData),
    seedSharedDocument(SHARED_DOC_IDS.exerciseRolesSchema, rolesSchemaData)
  ]);

  return {
    exerciseLibrary: libraryData,
    exerciseRoles: rolesData,
    exerciseVocabulary: vocabularyData,
    exerciseFileSchema: fileSchemaData,
    exerciseRolesSchema: rolesSchemaData
  };
}

/**
 * PT Data API - Unified data access layer
 *
 * Single write funnel for all PT data operations
 * - Event sourcing for exercise completions (append-only ledger)
 * - Versioned definitions for exercises, roles, vocabulary
 * - Automatic retry logic with user notification on failure
 * - Never overwrite, always append or version
 *
 * @module pt_data_api
 */

// Import shared Firebase instances from firebase.js
import { db, auth } from '../firebase.js';

// Import Firestore methods (must match firebase.js version: 12.7.0)
import {
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Phase 4: Offline queue support
import { withOfflineQueue } from './offline_queue.js';

// ============================================
// UTILITIES
// ============================================

/**
 * Generate ULID (Universally Unique Lexicographically Sortable Identifier)
 * @returns {string} ULID string
 */
function generateULID() {
    // Timestamp part (10 characters)
    const timestamp = Date.now();
    const timeChars = timestamp.toString(36).toUpperCase().padStart(10, '0');

    // Randomness part (16 characters)
    const randomPart = Array.from(
        { length: 16 },
        () => Math.floor(Math.random() * 36).toString(36)
    ).join('').toUpperCase();

    return timeChars + randomPart;
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current user ID
 * @returns {string|null}
 */
function getCurrentUserId() {
    const auth = getAuth();
    return auth.currentUser?.uid || null;
}

/**
 * Retry wrapper with exponential backoff
 * @param {Function} operation - Async operation to retry
 * @param {number} maxAttempts - Maximum retry attempts (default: 3)
 * @returns {Promise<any>}
 */
async function withRetry(operation, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxAttempts) {
                // Final attempt failed - notify user
                console.error('[API] Operation failed after', maxAttempts, 'attempts:', error);
                alert(`Operation failed: ${error.message}\n\nPlease check your internet connection and try again.`);
                throw error;
            }
            // Silent retry with exponential backoff
            const backoffMs = Math.pow(2, attempt) * 100;
            console.warn(`[API] Attempt ${attempt} failed, retrying in ${backoffMs}ms...`, error);
            await sleep(backoffMs);
        }
    }
}

// ============================================
// EXERCISE COMPLETIONS (Append-Only Ledger)
// ============================================

/**
 * Insert exercise completion event
 *
 * Structure: users/{userId}/activities/{exerciseULID}/completions/{completionULID}
 * - ONE document per completed exercise (not per set)
 * - NEVER overwrite previous completions
 * - Sets stored as array within completion document
 *
 * @param {object} event - Completion data
 * @param {string} event.exerciseId - Exercise ULID
 * @param {string} event.notes - Optional completion notes (exercise-level)
 * @param {object} event.formParams - Optional exercise-level form parameters {weight, band_position, etc}
 * @param {Array} event.sets - Array of set data [{index, side, reps, holdSeconds, timeSeconds, distance, formParams}]
 * @returns {Promise<string>} Completion ULID (transaction ID)
 *
 * iOS/Safari Notes: Returns ULID for user-visible transaction confirmation
 * Offline Handling: Will be wrapped with offline queue in Phase 4
 */
async function insertExerciseCompletion(event) {
    const userId = auth.currentUser?.uid;
    if (!userId) {
        throw new Error('User not authenticated');
    }

    // Validate required fields
    if (!event.exerciseId) {
        throw new Error('exerciseId is required');
    }

    // Validate sets array
    if (!event.sets || !Array.isArray(event.sets) || event.sets.length === 0) {
        throw new Error('At least one set is required (sets must be an array)');
    }

    const completionULID = generateULID();
    

    // Build completion document
    // Use client timestamp if provided (from offline queue), otherwise server timestamp
    const timestamp = event._clientTimestamp || serverTimestamp();

    const completionData = {
        exerciseId: event.exerciseId,  // Store exerciseId for adapter lookup
        timestamp,
        notes: event.notes || '',
        formParams: event.formParams || null,  // Exercise-level form parameters
        sets: event.sets.map((set, idx) => ({
            index: set.index ?? idx,  // Set number (0-based)
            side: set.side || null,  // 'left' | 'right' | 'both' | null
            reps: set.reps || null,
            holdSeconds: set.holdSeconds || null,
            timeSeconds: set.timeSeconds || null,
            distance: set.distance || null,
            formParams: set.formParams || null  // Set-specific overrides
        })),
        version: 1  // Schema version for future migrations
    };

    // Path: users/{userId}/sessions/{completionULID}
    // Uses existing canonical session root (not a new activities root)
    const completionRef = doc(
        db,
        'users', userId,
        'sessions', completionULID
    );

    await withRetry(async () => {
        await setDoc(completionRef, completionData);
    });

    console.log('[API] Exercise completion inserted:', completionULID, `(${event.sets.length} sets)`);

    // Return transaction ID for user display
    return completionULID;
}

/**
 * Get all completions for an exercise
 * @param {string} exerciseId - Exercise ULID
 * @param {number} limitCount - Max results (default: 100)
 * @returns {Promise<Array>} Array of completion documents
 */
export async function getExerciseCompletions(exerciseId, limitCount = 100) {
    const userId = auth.currentUser?.uid;
    if (!userId) {
        throw new Error('User not authenticated');
    }

    
    // Query from canonical sessions root with exerciseId filter
    const sessionsRef = collection(db, 'users', userId, 'sessions');

    const q = query(
        sessionsRef,
        where('exerciseId', '==', exerciseId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

// ============================================
// EXERCISE DEFINITIONS (Versioned)
// ============================================

/**
 * Create new exercise definition
 *
 * @param {object} def - Exercise definition
 * @param {string} def.name - Exercise name (required)
 * @param {string} def.description - Exercise description (required)
 * @param {object} def.dosage - Dosage specification {sets, repsPerSet, secondsPerRep, etc}
 * @param {array} def.tags - Exercise tags
 * @returns {Promise<{id: string, version: number}>}
 */
async function createExerciseDefinition(def) {
    const userId = auth.currentUser?.uid;
    if (!userId) {
        throw new Error('User not authenticated');
    }

    // Validate required fields
    if (!def.name || def.name.trim() === '') {
        throw new Error('Exercise name is required');
    }
    if (!def.description || def.description.trim() === '') {
        throw new Error('Exercise description is required');
    }

    // Check for duplicates (warn but allow)
    const duplicateId = await findDuplicateExercise(def.name);
    if (duplicateId) {
        const proceed = confirm(
            `An exercise named "${def.name}" already exists.\n\nCreate anyway?`
        );
        if (!proceed) {
            throw new Error('Exercise creation cancelled - duplicate name');
        }
    }

    const exerciseId = generateULID();
    

    // Create metadata document
    const metadataRef = doc(db, 'exercise_definitions', exerciseId);
    await withRetry(async () => {
        await setDoc(metadataRef, {
            createdAt: serverTimestamp(),
            createdBy: userId,
            latestVersion: 1
        });
    });

    // Create version 1
    const versionRef = doc(db, 'exercise_definitions', exerciseId, 'versions', 'v1');
    await withRetry(async () => {
        await setDoc(versionRef, {
            name: def.name.trim(),
            description: def.description.trim(),
            dosage: def.dosage || null,
            tags: def.tags || [],
            archived: false,
            timestamp: serverTimestamp(),
            changedBy: userId,
            version: 1
        });
    });

    console.log('[API] Exercise created:', exerciseId, 'v1');
    return { id: exerciseId, version: 1 };
}

/**
 * Find duplicate exercise by name
 * @param {string} name - Exercise name to search
 * @returns {Promise<string|null>} Exercise ID if found, null otherwise
 */
async function findDuplicateExercise(name) {
    
    const normalizedName = name.trim().toLowerCase();

    // Query all exercises (this is expensive - consider indexing)
    const defsRef = collection(db, 'exercise_definitions');
    const snapshot = await getDocs(defsRef);

    for (const defDoc of snapshot.docs) {
        const latestVersion = defDoc.data().latestVersion;
        const versionRef = doc(db, 'exercise_definitions', defDoc.id, 'versions', `v${latestVersion}`);
        const versionSnap = await getDoc(versionRef);

        if (versionSnap.exists()) {
            const exerciseName = versionSnap.data().name;
            if (exerciseName && exerciseName.trim().toLowerCase() === normalizedName) {
                return defDoc.id;
            }
        }
    }

    return null;
}

/**
 * Update exercise definition (creates new version)
 *
 * @param {string} id - Exercise ULID
 * @param {object} changes - Fields to update
 * @returns {Promise<{id: string, version: number}>}
 */
async function updateExerciseDefinition(id, changes) {
    const userId = auth.currentUser?.uid;
    if (!userId) {
        throw new Error('User not authenticated');
    }

    
    const metadataRef = doc(db, 'exercise_definitions', id);
    const metadataSnap = await getDoc(metadataRef);

    if (!metadataSnap.exists()) {
        throw new Error(`Exercise not found: ${id}`);
    }

    const currentVersion = metadataSnap.data().latestVersion;
    const newVersion = currentVersion + 1;

    // Load current version to merge changes
    const currentVersionRef = doc(db, 'exercise_definitions', id, 'versions', `v${currentVersion}`);
    const currentVersionSnap = await getDoc(currentVersionRef);

    if (!currentVersionSnap.exists()) {
        throw new Error(`Exercise version ${currentVersion} not found`);
    }

    const currentData = currentVersionSnap.data();
    const newData = {
        ...currentData,
        ...changes,
        version: newVersion,
        timestamp: serverTimestamp(),
        changedBy: userId
    };

    // Save new version
    const newVersionRef = doc(db, 'exercise_definitions', id, 'versions', `v${newVersion}`);
    await withRetry(async () => {
        await setDoc(newVersionRef, newData);
    });

    // Update latest pointer
    await withRetry(async () => {
        await updateDoc(metadataRef, {
            latestVersion: newVersion
        });
    });

    console.log('[API] Exercise updated:', id, `v${newVersion}`);
    return { id, version: newVersion };
}

/**
 * Archive exercise (soft delete - never actually delete)
 *
 * @param {string} id - Exercise ULID
 * @returns {Promise<void>}
 */
async function archiveExerciseDefinition(id) {
    const userId = auth.currentUser?.uid;
    if (!userId) {
        throw new Error('User not authenticated');
    }

    // Create new version with archived flag
    await updateExerciseDefinition(id, {
        archived: true,
        archivedAt: serverTimestamp(),
        archivedBy: userId
    });

    console.log('[API] Exercise archived:', id);
}

/**
 * Unarchive exercise (reversal)
 *
 * @param {string} id - Exercise ULID
 * @returns {Promise<void>}
 */
async function unarchiveExerciseDefinition(id) {
    const userId = auth.currentUser?.uid;
    if (!userId) {
        throw new Error('User not authenticated');
    }

    // Create new version with archived=false
    await updateExerciseDefinition(id, {
        archived: false,
        unarchivedAt: serverTimestamp(),
        unarchivedBy: userId
    });

    console.log('[API] Exercise unarchived:', id);
}

/**
 * Get exercise definition (latest version)
 *
 * @param {string} id - Exercise ULID
 * @returns {Promise<object>} Exercise data with id and version
 */
export async function getExercise(id) {
    
    const metadataRef = doc(db, 'exercise_definitions', id);
    const metadataSnap = await getDoc(metadataRef);

    if (!metadataSnap.exists()) {
        throw new Error(`Exercise not found: ${id}`);
    }

    const latestVersion = metadataSnap.data().latestVersion;
    const versionRef = doc(db, 'exercise_definitions', id, 'versions', `v${latestVersion}`);
    const versionSnap = await getDoc(versionRef);

    if (!versionSnap.exists()) {
        throw new Error(`Exercise version ${latestVersion} not found`);
    }

    return {
        id,
        version: latestVersion,
        ...versionSnap.data()
    };
}

/**
 * Get all exercises (latest versions only)
 *
 * @param {boolean} includeArchived - Include archived exercises (default: false)
 * @returns {Promise<Array>} Array of exercise definitions
 */
export async function getAllExercises(includeArchived = false) {
    // Read from OLD schema: pt_shared/exercise_library (blob with exercises array)
    // TODO: After migration (Phase 5), switch to new schema: exercise_definitions/{id}/versions/vX

    const libraryRef = doc(db, 'pt_shared', 'exercise_library');
    const librarySnap = await getDoc(libraryRef);

    if (!librarySnap.exists()) {
        console.warn('[getAllExercises] exercise_library document not found');
        return [];
    }

    const libraryData = librarySnap.data();
    const exercises = libraryData.exercises || [];

    // Filter archived if requested
    if (!includeArchived) {
        return exercises.filter(ex => !ex.archived);
    }

    return exercises;
}

/**
 * Create new exercise (OLD schema: pt_shared/exercise_library)
 * @param {object} exerciseData - Exercise data
 * @returns {Promise<string>} Exercise ID
 */
export async function createExercise(exerciseData) {
    const libraryRef = doc(db, 'pt_shared', 'exercise_library');
    const librarySnap = await getDoc(libraryRef);

    if (!librarySnap.exists()) {
        throw new Error('exercise_library document not found');
    }

    const libraryData = librarySnap.data();
    const exercises = libraryData.exercises || [];

    // Generate new exercise ID
    const newId = exerciseData.id || `ex${String(exercises.length + 1).padStart(4, '0')}`;

    // Add new exercise
    const newExercise = {
        id: newId,
        ...exerciseData,
        archived: false,
        created_at: new Date().toISOString()
    };

    exercises.push(newExercise);

    // Save back to Firestore
    await setDoc(libraryRef, { exercises }, { merge: true });

    console.log('[createExercise] Created:', newId);
    return newId;
}

/**
 * Update existing exercise (OLD schema: pt_shared/exercise_library)
 * @param {string} id - Exercise ID
 * @param {object} changes - Changes to apply
 * @returns {Promise<string>} Exercise ID
 */
export async function updateExercise(id, changes) {
    const libraryRef = doc(db, 'pt_shared', 'exercise_library');
    const librarySnap = await getDoc(libraryRef);

    if (!librarySnap.exists()) {
        throw new Error('exercise_library document not found');
    }

    const libraryData = librarySnap.data();
    const exercises = libraryData.exercises || [];

    // Find exercise
    const index = exercises.findIndex(ex => ex.id === id);
    if (index === -1) {
        throw new Error(`Exercise not found: ${id}`);
    }

    // Update exercise
    exercises[index] = {
        ...exercises[index],
        ...changes,
        updated_at: new Date().toISOString()
    };

    // Save back to Firestore
    await setDoc(libraryRef, { exercises }, { merge: true });

    console.log('[updateExercise] Updated:', id);
    return id;
}

/**
 * Archive exercise (OLD schema: pt_shared/exercise_library)
 * @param {string} id - Exercise ID
 * @returns {Promise<string>} Exercise ID
 */
export async function archiveExercise(id) {
    return await updateExercise(id, { archived: true });
}

/**
 * Unarchive exercise (OLD schema: pt_shared/exercise_library)
 * @param {string} id - Exercise ID
 * @returns {Promise<string>} Exercise ID
 */
export async function unarchiveExercise(id) {
    return await updateExercise(id, { archived: false });
}

// ============================================
// ROLES (Versioned, per exercise)
// ============================================

/**
 * Create role for an exercise
 *
 * @param {string} exerciseId - Exercise ULID
 * @param {object} roleDef - Role definition {region, capacity, contribution, focus}
 * @returns {Promise<string>} Role ID
 */
async function createRole(exerciseId, roleDef) {
    const userId = auth.currentUser?.uid;
    if (!userId) {
        throw new Error('User not authenticated');
    }

    // Validate required fields
    if (!roleDef.region || !roleDef.capacity || !roleDef.contribution) {
        throw new Error('region, capacity, and contribution are required for roles');
    }

    const roleId = generateULID();
    

    // Ensure exercise_roles metadata exists
    const metadataRef = doc(db, 'exercise_roles', exerciseId);
    const metadataSnap = await getDoc(metadataRef);

    if (!metadataSnap.exists()) {
        // Create initial metadata
        await withRetry(async () => {
            await setDoc(metadataRef, {
                latestVersion: 1
            });
        });
    }

    const version = metadataSnap.exists() ? metadataSnap.data().latestVersion : 1;

    // Create role document
    const roleRef = doc(db, 'exercise_roles', exerciseId, 'versions', `v${version}`, 'roles', roleId);
    await withRetry(async () => {
        await setDoc(roleRef, {
            region: roleDef.region,
            capacity: roleDef.capacity,
            contribution: roleDef.contribution,
            focus: roleDef.focus || '',
            createdAt: serverTimestamp(),
            createdBy: userId,
            deletedAt: null
        });
    });

    console.log('[API] Role created:', roleId, 'for exercise', exerciseId);
    return roleId;
}

/**
 * Delete role (soft delete with tombstone)
 *
 * @param {string} exerciseId - Exercise ULID
 * @param {string} roleId - Role ID
 * @returns {Promise<void>}
 */
async function deleteRole(exerciseId, roleId) {
    const userId = auth.currentUser?.uid;
    if (!userId) {
        throw new Error('User not authenticated');
    }

    
    const metadataRef = doc(db, 'exercise_roles', exerciseId);
    const metadataSnap = await getDoc(metadataRef);

    if (!metadataSnap.exists()) {
        throw new Error(`Exercise roles not found: ${exerciseId}`);
    }

    const version = metadataSnap.data().latestVersion;
    const roleRef = doc(db, 'exercise_roles', exerciseId, 'versions', `v${version}`, 'roles', roleId);

    // Set deletedAt timestamp (soft delete)
    await withRetry(async () => {
        await updateDoc(roleRef, {
            deletedAt: serverTimestamp(),
            deletedBy: userId
        });
    });

    console.log('[API] Role deleted (soft):', roleId);
}

/**
 * Get all roles for an exercise
 *
 * @param {string} exerciseId - Exercise ULID
 * @param {boolean} includeDeleted - Include soft-deleted roles (default: false)
 * @returns {Promise<Array>} Array of roles
 */
export async function getRoles(exerciseId, includeDeleted = false) {
    
    const metadataRef = doc(db, 'exercise_roles', exerciseId);
    const metadataSnap = await getDoc(metadataRef);

    if (!metadataSnap.exists()) {
        return [];
    }

    const version = metadataSnap.data().latestVersion;
    const rolesRef = collection(db, 'exercise_roles', exerciseId, 'versions', `v${version}`, 'roles');
    const snapshot = await getDocs(rolesRef);

    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(role => includeDeleted || !role.deletedAt);
}

// ============================================
// VOCABULARY (Versioned)
// ============================================

/**
 * Update vocabulary term
 *
 * @param {string} category - Vocabulary category
 * @param {string} term - Term key
 * @param {string} definition - Term definition
 * @returns {Promise<void>}
 */
async function updateVocabulary(category, term, definition) {
    const userId = auth.currentUser?.uid;
    if (!userId) {
        throw new Error('User not authenticated');
    }

    
    const termId = term.replace(/[^a-zA-Z0-9_]/g, '_');

    // Ensure category metadata exists
    const categoryRef = doc(db, 'vocabulary', category);
    const categorySnap = await getDoc(categoryRef);

    let version = 1;
    if (categorySnap.exists()) {
        version = categorySnap.data().latestVersion;
    } else {
        await withRetry(async () => {
            await setDoc(categoryRef, {
                latestVersion: 1
            });
        });
    }

    // Create/update term
    const termRef = doc(db, 'vocabulary', category, 'versions', `v${version}`, 'terms', termId);
    await withRetry(async () => {
        await setDoc(termRef, {
            term,
            definition,
            updatedAt: serverTimestamp(),
            updatedBy: userId
        });
    });

    console.log('[API] Vocabulary updated:', category, term);
}

/**
 * Get vocabulary for a category
 *
 * @param {string} category - Vocabulary category
 * @returns {Promise<object>} Object of term -> definition
 */
export async function getVocabulary(category) {
    
    const categoryRef = doc(db, 'vocabulary', category);
    const categorySnap = await getDoc(categoryRef);

    if (!categorySnap.exists()) {
        return {};
    }

    const version = categorySnap.data().latestVersion;
    const termsRef = collection(db, 'vocabulary', category, 'versions', `v${version}`, 'terms');
    const snapshot = await getDocs(termsRef);

    const vocab = {};
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        vocab[data.term] = data.definition;
    });

    return vocab;
}

// ============================================
// OFFLINE QUEUE WRAPPERS (Phase 4)
// ============================================

/**
 * Wrapped write operations with offline queue support
 *
 * Original implementations remain available as *Internal for replay
 * Exported versions automatically queue when offline
 */

// Create wrapped versions (auto-queue when offline)
const insertExerciseCompletionWrapped = withOfflineQueue(insertExerciseCompletion, 'insertExerciseCompletion');
const createExerciseWrapped = withOfflineQueue(createExercise, 'createExercise');
const updateExerciseWrapped = withOfflineQueue(updateExercise, 'updateExercise');
const archiveExerciseWrapped = withOfflineQueue(archiveExercise, 'archiveExercise');
const unarchiveExerciseWrapped = withOfflineQueue(unarchiveExercise, 'unarchiveExercise');
const createRoleWrapped = withOfflineQueue(createRole, 'createRole');
const deleteRoleWrapped = withOfflineQueue(deleteRole, 'deleteRole');
const updateVocabularyWrapped = withOfflineQueue(updateVocabulary, 'updateVocabulary');

// Export internal versions for offline queue replay
export {
    insertExerciseCompletion as insertExerciseCompletionInternal,
    createExercise as createExerciseInternal,
    updateExercise as updateExerciseInternal,
    archiveExercise as archiveExerciseInternal,
    unarchiveExercise as unarchiveExerciseInternal,
    createRole as createRoleInternal,
    deleteRole as deleteRoleInternal,
    updateVocabulary as updateVocabularyInternal
};

// Export wrapped versions for application use
export {
    insertExerciseCompletionWrapped as insertExerciseCompletion,
    createExerciseWrapped as createExercise,
    updateExerciseWrapped as updateExercise,
    archiveExerciseWrapped as archiveExercise,
    unarchiveExerciseWrapped as unarchiveExercise,
    createRoleWrapped as createRole,
    deleteRoleWrapped as deleteRole,
    updateVocabularyWrapped as updateVocabulary
};

// ============================================
// EXPORT
// ============================================

export default {
    // Completions
    insertExerciseCompletion: insertExerciseCompletionWrapped,
    getExerciseCompletions,

    // Exercise Definitions
    createExercise: createExerciseWrapped,
    updateExercise: updateExerciseWrapped,
    archiveExercise: archiveExerciseWrapped,
    unarchiveExercise: unarchiveExerciseWrapped,
    getExercise,
    getAllExercises,

    // Roles
    createRole: createRoleWrapped,
    deleteRole: deleteRoleWrapped,
    getRoles,

    // Vocabulary
    updateVocabulary: updateVocabularyWrapped,
    getVocabulary,

    // Internal versions (for offline queue replay)
    insertExerciseCompletionInternal: insertExerciseCompletion,
    createExerciseInternal: createExercise,
    updateExerciseInternal: updateExercise,
    archiveExerciseInternal: archiveExercise,
    unarchiveExerciseInternal: unarchiveExercise,
    createRoleInternal: createRole,
    deleteRoleInternal: deleteRole,
    updateVocabularyInternal: updateVocabulary
};

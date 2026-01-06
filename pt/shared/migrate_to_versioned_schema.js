/**
 * Migration Script: Old Schema → New Versioned Schema
 *
 * Migrates from:
 * - pt_shared/exercise_library (blob with array)
 * - pt_shared/exercise_roles (blob with object)
 * - pt_shared/vocabulary_* (blobs)
 * - users/{uid}/sessions (array-based session docs)
 *
 * To:
 * - exercise_definitions/{id}/versions/{v1}
 * - exercise_roles/{id}/versions/{v1}/roles/{roleId}
 * - vocabulary/{category}/versions/{v1}/terms/{termId}
 * - users/{uid}/activities/{exerciseULID}/completions/{completionULID}
 *
 * Strategy:
 * - Run old and new schemas in parallel
 * - Do NOT delete old data (keep for rollback)
 * - Create version 1 for all existing data
 * - Log all migrations for verification
 *
 * @module migrate_to_versioned_schema
 */

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    addDoc,
    collection,
    getDocs,
    query,
    orderBy,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";

// ============================================
// UTILITIES
// ============================================

function generateULID() {
    const timestamp = Date.now();
    const timeChars = timestamp.toString(36).toUpperCase().padStart(10, '0');
    const randomPart = Array.from(
        { length: 16 },
        () => Math.floor(Math.random() * 36).toString(36)
    ).join('').toUpperCase();
    return timeChars + randomPart;
}

// ============================================
// MIGRATION FUNCTIONS
// ============================================

/**
 * Migrate exercise library from blob to versioned documents
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function migrateExerciseLibrary() {
    const db = getFirestore();
    const auth = getAuth();

    console.log('[Migration] Starting exercise library migration...');

    // Read old schema
    const oldLibraryRef = doc(db, 'pt_shared', 'exercise_library');
    const oldLibrarySnap = await getDoc(oldLibraryRef);

    if (!oldLibrarySnap.exists()) {
        console.warn('[Migration] Old exercise library not found - nothing to migrate');
        return { success: 0, failed: 0 };
    }

    const oldLibrary = oldLibrarySnap.data();
    const exercises = oldLibrary.exercises || [];

    console.log(`[Migration] Found ${exercises.length} exercises to migrate`);

    let success = 0;
    let failed = 0;

    for (const exercise of exercises) {
        try {
            // Use existing ID if available, otherwise generate ULID
            const exerciseId = exercise.id || exercise.exercise_id || generateULID();

            // Create metadata document
            const metadataRef = doc(db, 'exercise_definitions', exerciseId);
            await setDoc(metadataRef, {
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser?.uid || 'migration',
                latestVersion: 1
            });

            // Create version 1
            const versionRef = doc(db, 'exercise_definitions', exerciseId, 'versions', 'v1');
            await setDoc(versionRef, {
                name: exercise.name || exercise.canonical_name || 'Unnamed Exercise',
                description: exercise.description || '',
                dosage: exercise.dosage || null,
                tags: exercise.tags || [],
                archived: exercise.archived || false,
                timestamp: serverTimestamp(),
                changedBy: auth.currentUser?.uid || 'migration',
                version: 1,
                // Preserve any other fields
                ...exercise
            });

            console.log(`[Migration] Migrated exercise: ${exerciseId} (${exercise.name})`);
            success++;
        } catch (error) {
            console.error('[Migration] Failed to migrate exercise:', exercise.name, error);
            failed++;
        }
    }

    console.log(`[Migration] Exercise library migration complete: ${success} success, ${failed} failed`);
    return { success, failed };
}

/**
 * Migrate exercise roles from blob to versioned documents
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function migrateExerciseRoles() {
    const db = getFirestore();
    const auth = getAuth();

    console.log('[Migration] Starting exercise roles migration...');

    // Read old schema
    const oldRolesRef = doc(db, 'pt_shared', 'exercise_roles');
    const oldRolesSnap = await getDoc(oldRolesRef);

    if (!oldRolesSnap.exists()) {
        console.warn('[Migration] Old exercise roles not found - nothing to migrate');
        return { success: 0, failed: 0 };
    }

    const oldRoles = oldRolesSnap.data();
    const exerciseRoles = oldRoles.exercise_roles || {};

    const exerciseIds = Object.keys(exerciseRoles);
    console.log(`[Migration] Found ${exerciseIds.length} exercises with roles to migrate`);

    let success = 0;
    let failed = 0;

    for (const exerciseId of exerciseIds) {
        try {
            const rolesData = exerciseRoles[exerciseId];
            const roles = rolesData.roles || [];

            if (roles.length === 0) {
                console.log(`[Migration] Skipping ${exerciseId} - no roles`);
                continue;
            }

            // Create metadata document
            const metadataRef = doc(db, 'exercise_roles', exerciseId);
            await setDoc(metadataRef, {
                latestVersion: 1
            });

            // Migrate each role
            for (const role of roles) {
                const roleId = generateULID();
                const roleRef = doc(db, 'exercise_roles', exerciseId, 'versions', 'v1', 'roles', roleId);

                await setDoc(roleRef, {
                    region: role.region || '',
                    capacity: role.capacity || '',
                    contribution: role.contribution || '',
                    focus: role.focus || '',
                    createdAt: serverTimestamp(),
                    createdBy: auth.currentUser?.uid || 'migration',
                    deletedAt: null
                });
            }

            console.log(`[Migration] Migrated ${roles.length} roles for exercise: ${exerciseId}`);
            success++;
        } catch (error) {
            console.error('[Migration] Failed to migrate roles for exercise:', exerciseId, error);
            failed++;
        }
    }

    console.log(`[Migration] Exercise roles migration complete: ${success} success, ${failed} failed`);
    return { success, failed };
}

/**
 * Migrate vocabulary from blobs to versioned documents
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function migrateVocabulary() {
    const db = getFirestore();
    const auth = getAuth();

    console.log('[Migration] Starting vocabulary migration...');

    const categories = ['exercise_library', 'exercise_roles'];
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const category of categories) {
        try {
            // Read old schema (vocabulary stored as pt_shared/vocabulary_{category})
            const oldVocabRef = doc(db, 'pt_shared', `exercise_${category}_vocabulary`);
            const oldVocabSnap = await getDoc(oldVocabRef);

            if (!oldVocabSnap.exists()) {
                console.warn(`[Migration] Old vocabulary not found for category: ${category}`);
                continue;
            }

            const oldVocab = oldVocabSnap.data();

            // Create category metadata
            const categoryRef = doc(db, 'vocabulary', category);
            await setDoc(categoryRef, {
                latestVersion: 1
            });

            // Migrate each term
            const terms = Object.keys(oldVocab);
            for (const term of terms) {
                const termId = term.replace(/[^a-zA-Z0-9_]/g, '_');
                const termRef = doc(db, 'vocabulary', category, 'versions', 'v1', 'terms', termId);

                await setDoc(termRef, {
                    term,
                    definition: oldVocab[term],
                    updatedAt: serverTimestamp(),
                    updatedBy: auth.currentUser?.uid || 'migration'
                });
            }

            console.log(`[Migration] Migrated ${terms.length} vocabulary terms for category: ${category}`);
            totalSuccess++;
        } catch (error) {
            console.error('[Migration] Failed to migrate vocabulary for category:', category, error);
            totalFailed++;
        }
    }

    console.log(`[Migration] Vocabulary migration complete: ${totalSuccess} categories success, ${totalFailed} failed`);
    return { success: totalSuccess, failed: totalFailed };
}

/**
 * Migrate user sessions from array-based to completion-based structure
 *
 * Old: users/{uid}/sessions/{sessionId} with sets: [...]
 * New: users/{uid}/activities/{exerciseULID}/completions/{completionULID}
 *
 * @param {string} userId - User ID to migrate
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function migrateUserSessions(userId) {
    const db = getFirestore();

    console.log(`[Migration] Starting session migration for user: ${userId}`);

    // Read old sessions
    const oldSessionsRef = collection(db, 'users', userId, 'sessions');
    const oldSessionsSnap = await getDocs(query(oldSessionsRef, orderBy('date', 'desc')));

    const sessions = oldSessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`[Migration] Found ${sessions.length} sessions to migrate`);

    let success = 0;
    let failed = 0;

    for (const session of sessions) {
        try {
            const exerciseId = session.exerciseId || session.exercise_id;
            if (!exerciseId) {
                console.warn('[Migration] Session missing exerciseId, skipping:', session.id);
                failed++;
                continue;
            }

            // Extract completion data per set
            const sets = session.sets || session.sessionData || [];

            for (const set of sets) {
                const completionULID = generateULID();
                const completionRef = doc(
                    db,
                    'users', userId,
                    'activities', exerciseId,
                    'completions', completionULID
                );

                // Convert old set structure to new per-side structure
                const completionData = {
                    timestamp: session.date ? new Date(session.date) : serverTimestamp(),
                    notes: session.notes || '',
                    leftSide: set.side === 'left' || set.side === 'bilateral' ? {
                        reps: set.reps || null,
                        timeSeconds: set.time || null,
                        holdSeconds: set.hold || null,
                        distance: set.distance || null,
                        formParams: set.formParams || null
                    } : null,
                    rightSide: set.side === 'right' || set.side === 'bilateral' ? {
                        reps: set.reps || null,
                        timeSeconds: set.time || null,
                        holdSeconds: set.hold || null,
                        distance: set.distance || null,
                        formParams: set.formParams || null
                    } : null,
                    bilateral: set.side === 'bilateral' ? {
                        reps: set.reps || null,
                        timeSeconds: set.time || null,
                        holdSeconds: set.hold || null,
                        distance: set.distance || null,
                        formParams: set.formParams || null
                    } : null,
                    version: 1
                };

                await setDoc(completionRef, completionData);
            }

            console.log(`[Migration] Migrated session ${session.id} (${sets.length} completions)`);
            success++;
        } catch (error) {
            console.error('[Migration] Failed to migrate session:', session.id, error);
            failed++;
        }
    }

    console.log(`[Migration] User sessions migration complete: ${success} success, ${failed} failed`);
    return { success, failed };
}

// ============================================
// MAIN MIGRATION RUNNER
// ============================================

/**
 * Run full migration
 * @param {string} userId - Optional user ID for session migration
 */
export async function runFullMigration(userId = null) {
    console.log('========================================');
    console.log('MIGRATION START:', new Date().toISOString());
    console.log('========================================');

    const results = {
        library: { success: 0, failed: 0 },
        roles: { success: 0, failed: 0 },
        vocabulary: { success: 0, failed: 0 },
        sessions: { success: 0, failed: 0 }
    };

    try {
        // Migrate exercise library
        results.library = await migrateExerciseLibrary();

        // Migrate exercise roles
        results.roles = await migrateExerciseRoles();

        // Migrate vocabulary
        results.vocabulary = await migrateVocabulary();

        // Migrate user sessions (if userId provided)
        if (userId) {
            results.sessions = await migrateUserSessions(userId);
        } else {
            console.log('[Migration] Skipping session migration (no userId provided)');
        }

    } catch (error) {
        console.error('[Migration] Fatal error during migration:', error);
    }

    console.log('========================================');
    console.log('MIGRATION RESULTS:');
    console.log('Library:', results.library);
    console.log('Roles:', results.roles);
    console.log('Vocabulary:', results.vocabulary);
    console.log('Sessions:', results.sessions);
    console.log('========================================');

    return results;
}

/**
 * Verify migration was successful
 * @returns {Promise<object>} Verification results
 */
export async function verifyMigration() {
    const db = getFirestore();

    console.log('[Verify] Starting migration verification...');

    const checks = {
        exercisesExist: false,
        rolesExist: false,
        vocabularyExists: false,
        versioningWorks: false
    };

    try {
        // Check exercises exist
        const defsSnapshot = await getDocs(collection(db, 'exercise_definitions'));
        checks.exercisesExist = defsSnapshot.size > 0;
        console.log(`[Verify] Found ${defsSnapshot.size} exercise definitions`);

        // Check roles exist
        const rolesSnapshot = await getDocs(collection(db, 'exercise_roles'));
        checks.rolesExist = rolesSnapshot.size > 0;
        console.log(`[Verify] Found ${rolesSnapshot.size} exercise role sets`);

        // Check vocabulary exists
        const vocabSnapshot = await getDocs(collection(db, 'vocabulary'));
        checks.vocabularyExists = vocabSnapshot.size > 0;
        console.log(`[Verify] Found ${vocabSnapshot.size} vocabulary categories`);

        // Check versioning works (sample first exercise)
        if (defsSnapshot.size > 0) {
            const firstDef = defsSnapshot.docs[0];
            const metadata = firstDef.data();
            const versionSnapshot = await getDocs(
                collection(db, 'exercise_definitions', firstDef.id, 'versions')
            );
            checks.versioningWorks = versionSnapshot.size > 0 && metadata.latestVersion > 0;
            console.log(`[Verify] Versioning check: ${versionSnapshot.size} versions, latest: v${metadata.latestVersion}`);
        }

    } catch (error) {
        console.error('[Verify] Verification failed:', error);
    }

    const allPassed = Object.values(checks).every(v => v);
    console.log('[Verify] Verification result:', allPassed ? 'PASS' : 'FAIL', checks);

    return { passed: allPassed, checks };
}

// ============================================
// EXPORT
// ============================================

export default {
    migrateExerciseLibrary,
    migrateExerciseRoles,
    migrateVocabulary,
    migrateUserSessions,
    runFullMigration,
    verifyMigration
};

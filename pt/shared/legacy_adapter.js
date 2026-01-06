/**
 * Legacy Adapter - Convert new completion records to legacy session shape
 *
 * Allows pt_tracker, pt_view, rehab_coverage to continue working unchanged
 * while we use new event-sourced storage underneath.
 *
 * Critical Constraint: Consumers must not be modified during Phases 1-4
 *
 * @module legacy_adapter
 */

import { getExercise } from './pt_data_api.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Derive exercise type from definition
 * @param {object} def - Exercise definition
 * @returns {string} Exercise type ('reps' | 'duration' | 'hold' | 'distance' | 'amrap')
 */
function deriveExerciseType(def) {
    const modifiers = def.pattern_modifiers || [];

    // Check pattern modifiers for type hints
    if (modifiers.includes('duration_seconds')) return 'duration';
    if (modifiers.includes('hold_seconds')) return 'hold';
    if (modifiers.includes('distance_feet')) return 'distance';
    if (modifiers.includes('AMRAP')) return 'amrap';

    // Check dosage structure as fallback
    if (def.dosage) {
        if (def.dosage.durationSeconds) return 'duration';
        if (def.dosage.holdSeconds) return 'hold';
        if (def.dosage.distanceFeet) return 'distance';
    }

    // Default to reps-based
    return 'reps';
}

/**
 * Calculate average reps across sets
 * @param {Array} sets - Array of set data
 * @returns {number} Average reps (rounded)
 */
function avgReps(sets) {
    const repsOnly = sets.filter(s => s.reps != null && s.reps > 0);
    if (repsOnly.length === 0) return 0;

    const total = repsOnly.reduce((sum, s) => sum + s.reps, 0);
    return Math.round(total / repsOnly.length);
}

/**
 * Calculate average hold time across sets
 * @param {Array} sets - Array of set data
 * @returns {number} Average hold seconds
 */
function avgHoldSeconds(sets) {
    const holdOnly = sets.filter(s => s.holdSeconds != null && s.holdSeconds > 0);
    if (holdOnly.length === 0) return 0;

    const total = holdOnly.reduce((sum, s) => sum + s.holdSeconds, 0);
    return Math.round(total / holdOnly.length);
}

/**
 * Convert Firestore Timestamp to ISO string
 * @param {any} timestamp - Firestore Timestamp or ISO string
 * @returns {string} ISO 8601 timestamp string
 */
function toISOString(timestamp) {
    if (!timestamp) return new Date().toISOString();

    // Firestore Timestamp has toDate() method
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }

    // Already a string
    if (typeof timestamp === 'string') {
        return timestamp;
    }

    // Date object
    if (timestamp instanceof Date) {
        return timestamp.toISOString();
    }

    // Fallback
    return new Date().toISOString();
}

// ============================================
// ADAPTER FUNCTIONS
// ============================================

/**
 * Convert new completion record to legacy session shape
 *
 * @param {object} completion - Completion record from Firestore
 * @param {string} completion.id - Completion ULID
 * @param {string} completion.exerciseId - Exercise ULID
 * @param {object} completion.timestamp - Firestore Timestamp
 * @param {string} completion.notes - Session notes
 * @param {object} completion.formParams - Exercise-level form parameters
 * @param {Array} completion.sets - Array of set data
 * @param {object} exerciseDefinition - Exercise definition (from getExercise)
 * @returns {object} Legacy session object
 *
 * Legacy shape:
 * {
 *   sessionId: string,
 *   exerciseId: string,
 *   exerciseName: string,
 *   exerciseType: string,
 *   date: ISO string,
 *   notes: string,
 *   exerciseSpec: {sets, repsPerSet, secondsPerRep, type},
 *   sets: [{set, reps, timestamp, side, formParams, ...}]
 * }
 */
export function completionToLegacySession(completion, exerciseDefinition) {
    // Validate inputs
    if (!completion) {
        throw new Error('completion is required');
    }
    if (!exerciseDefinition) {
        throw new Error('exerciseDefinition is required - pass result from getExercise()');
    }

    const exerciseType = deriveExerciseType(exerciseDefinition);
    const isoTimestamp = toISOString(completion.timestamp);

    // Build legacy session object
    return {
        // Core identifiers
        sessionId: completion.id,
        exerciseId: exerciseDefinition.id,
        exerciseName: exerciseDefinition.name || exerciseDefinition.canonical_name || 'Unknown Exercise',
        exerciseType: exerciseType,

        // Timestamps
        date: isoTimestamp,

        // Notes (exercise-level)
        notes: completion.notes || '',

        // Exercise specification (for display/context)
        exerciseSpec: {
            sets: completion.sets.length,
            repsPerSet: avgReps(completion.sets),
            secondsPerRep: avgHoldSeconds(completion.sets),
            type: exerciseType
        },

        // Sets array (converted from 0-based to 1-based indexing)
        sets: completion.sets.map(set => {
            const legacySet = {
                set: set.index + 1,  // Convert to 1-based
                timestamp: isoTimestamp,
                side: set.side || undefined
            };

            // Add metrics that are present
            if (set.reps != null) legacySet.reps = set.reps;
            if (set.holdSeconds != null) legacySet.holdSeconds = set.holdSeconds;
            if (set.timeSeconds != null) legacySet.secondsAchieved = set.timeSeconds;
            if (set.distance != null) legacySet.distanceFeet = set.distance;

            // Add form parameters if present
            if (set.formParams) {
                legacySet.formParams = set.formParams;
            }

            return legacySet;
        })
    };
}

/**
 * Batch convert multiple completions to legacy sessions
 *
 * @param {Array} completions - Array of completion records
 * @param {object} exerciseDefinition - Exercise definition (same for all)
 * @returns {Promise<Array>} Array of legacy session objects
 *
 * Note: This assumes all completions are for the same exercise
 */
export async function completionsToLegacySessions(completions, exerciseDefinition) {
    if (!Array.isArray(completions)) {
        throw new Error('completions must be an array');
    }

    return completions.map(c => completionToLegacySession(c, exerciseDefinition));
}

/**
 * Fetch exercise definition and convert completion to legacy session
 * Convenience wrapper that fetches exercise definition automatically
 *
 * @param {object} completion - Completion record
 * @returns {Promise<object>} Legacy session object
 *
 * Note: Makes additional Firestore call to fetch exercise definition
 * Use completionToLegacySession() directly if you already have the definition
 */
export async function completionToLegacySessionWithFetch(completion) {
    if (!completion.exerciseId) {
        throw new Error('completion must have exerciseId field');
    }

    // Fetch exercise definition
    const exerciseDefinition = await getExercise(completion.exerciseId);

    // Convert to legacy shape
    return completionToLegacySession(completion, exerciseDefinition);
}

/**
 * Batch fetch and convert multiple completions
 *
 * @param {Array} completions - Array of completion records (may be for different exercises)
 * @returns {Promise<Array>} Array of legacy session objects
 *
 * Note: Groups by exerciseId to minimize Firestore reads
 */
export async function completionsToLegacySessionsWithFetch(completions) {
    if (!Array.isArray(completions)) {
        throw new Error('completions must be an array');
    }

    // Group completions by exerciseId
    const groups = {};
    completions.forEach(c => {
        if (!c.exerciseId) {
            console.warn('[Adapter] Completion missing exerciseId, skipping:', c.id);
            return;
        }
        if (!groups[c.exerciseId]) {
            groups[c.exerciseId] = [];
        }
        groups[c.exerciseId].push(c);
    });

    // Fetch exercise definitions and convert
    const results = [];
    for (const [exerciseId, groupedCompletions] of Object.entries(groups)) {
        try {
            const exerciseDefinition = await getExercise(exerciseId);

            // Convert all completions for this exercise
            groupedCompletions.forEach(c => {
                results.push(completionToLegacySession(c, exerciseDefinition));
            });
        } catch (error) {
            console.error(`[Adapter] Failed to fetch exercise ${exerciseId}:`, error);
            // Skip completions for this exercise
        }
    }

    return results;
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
    completionToLegacySession,
    completionsToLegacySessions,
    completionToLegacySessionWithFetch,
    completionsToLegacySessionsWithFetch
};

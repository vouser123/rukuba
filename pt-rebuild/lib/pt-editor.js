// pt-editor.js — exercise data access functions (pt-editor page only)

/**
 * Fetch all exercises with full related data (equipment, muscles, guidance, etc.).
 * @param {string} accessToken
 * @returns {Promise<Array>}
 */
export async function fetchExercises(accessToken) {
  const res = await fetch('/api/exercises', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to load exercises: ${res.status}`);
  const data = await res.json();
  return data.exercises;
}

/**
 * Fetch all active vocabulary terms, keyed by category.
 * Returns { region: [{code, definition, ...}], capacity: [...], ... }
 * @param {string} accessToken
 * @returns {Promise<Object>}
 */
export async function fetchVocabularies(accessToken) {
  const res = await fetch('/api/vocab', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to load vocabularies: ${res.status}`);
  const data = await res.json();
  return data.vocabularies;
}

/**
 * Fetch reference data: distinct equipment, muscle, and form parameter names in use.
 * Returns { equipment: [], muscles: [], formParameters: [] }
 * @param {string} accessToken
 * @returns {Promise<Object>}
 */
export async function fetchReferenceData(accessToken) {
  const res = await fetch('/api/reference-data', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to load reference data: ${res.status}`);
  return res.json();
}

/**
 * Create a new exercise. Payload shape matches the exercises API POST contract.
 * @param {string} accessToken
 * @param {Object} exercise
 * @returns {Promise<Object>} { exercise: rawRow }
 */
export async function createExercise(accessToken, exercise) {
  const res = await fetch('/api/exercises', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(exercise),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create exercise: ${res.status}`);
  }
  return res.json();
}

/**
 * Update an existing exercise by ID. Sends only the fields that changed.
 * @param {string} accessToken
 * @param {string} exerciseId
 * @param {Object} exercise
 * @returns {Promise<Object>} { exercise: rawRow }
 */
export async function updateExercise(accessToken, exerciseId, exercise) {
  const res = await fetch(`/api/exercises?id=${encodeURIComponent(exerciseId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(exercise),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update exercise: ${res.status}`);
  }
  return res.json();
}

/**
 * Generate a slug-based exercise ID from a canonical name.
 * Matches the legacy pt_editor.js pattern: lowercase, underscores, trimmed.
 * @param {string} name
 * @returns {string}
 */
export function generateExerciseId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

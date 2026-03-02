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
 * Fetch role assignments for a specific exercise.
 * @param {string} accessToken
 * @param {string} exerciseId
 * @returns {Promise<Array>}
 */
export async function fetchRoles(accessToken, exerciseId) {
  const res = await fetch(`/api/roles?exercise_id=${encodeURIComponent(exerciseId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to load roles: ${res.status}`);
  const data = await res.json();
  return data.roles;
}

/**
 * Create a new role assignment for an exercise.
 * @param {string} accessToken
 * @param {{ exercise_id, region, capacity, focus, contribution }} roleData
 * @returns {Promise<Object>} { role }
 */
export async function addRole(accessToken, roleData) {
  const res = await fetch('/api/roles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(roleData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to add role: ${res.status}`);
  }
  return res.json();
}

/**
 * Soft-delete a role assignment (sets active=false).
 * @param {string} accessToken
 * @param {string} roleId
 * @returns {Promise<void>}
 */
export async function deleteRole(accessToken, roleId) {
  const res = await fetch(`/api/roles/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete role: ${res.status}`);
  }
}

/**
 * Fetch all active program assignments for a patient, keyed by exercise_id.
 * @param {string} accessToken
 * @param {string} patientId
 * @returns {Promise<Object>} programs keyed by exercise_id for O(1) lookup
 */
export async function fetchPrograms(accessToken, patientId) {
  const res = await fetch(`/api/programs?patient_id=${encodeURIComponent(patientId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to load programs: ${res.status}`);
  const data = await res.json();
  return Object.fromEntries((data.programs ?? []).map(p => [p.exercise_id, p]));
}

/**
 * Assign a dosage to an exercise for a patient (create program record).
 * @param {string} accessToken
 * @param {{ patient_id, exercise_id, sets, reps_per_set, seconds_per_rep, distance_feet }} data
 * @returns {Promise<Object>} { program }
 */
export async function createProgram(accessToken, data) {
  const res = await fetch('/api/programs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create program: ${res.status}`);
  }
  return res.json();
}

/**
 * Update a patient program's dosage.
 * @param {string} accessToken
 * @param {string} programId
 * @param {{ sets, reps_per_set, seconds_per_rep, distance_feet }} updates
 * @returns {Promise<Object>} { program }
 */
export async function updateProgram(accessToken, programId, updates) {
  const res = await fetch(`/api/programs?id=${encodeURIComponent(programId)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update program: ${res.status}`);
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

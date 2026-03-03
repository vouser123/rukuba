// lib/index-data.js — fetch adapters for tracker exercises, programs, and history logs
function authHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export async function fetchIndexExercises(token) {
    const response = await fetch('/api/exercises', {
        headers: authHeaders(token),
    });
    if (!response.ok) {
        throw new Error(`Failed to load exercises (${response.status})`);
    }
    const data = await response.json();
    return data.exercises ?? [];
}

export async function fetchIndexPrograms(token, patientId) {
    const response = await fetch(`/api/programs?patient_id=${patientId}`, {
        headers: authHeaders(token),
    });
    if (!response.ok) {
        throw new Error(`Failed to load programs (${response.status})`);
    }
    const data = await response.json();
    return data.programs ?? [];
}

// DN-059: Omit patient_id — API uses req.user.id (profile UUID) via fallback.
// Passing session.user.id (auth UUID) caused 0 rows since patient_activity_logs
// stores profile UUIDs; the logs API has no auth_id→users.id resolution.
export async function fetchIndexLogs(token) {
    const response = await fetch('/api/logs?include_all=true&limit=1000', {
        headers: authHeaders(token),
    });
    if (!response.ok) {
        throw new Error(`Failed to load logs (${response.status})`);
    }
    const data = await response.json();
    return data.logs ?? [];
}

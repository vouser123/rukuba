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

export async function fetchIndexLogs(token, patientId) {
    const response = await fetch(`/api/logs?patient_id=${patientId}&limit=1000`, {
        headers: authHeaders(token),
    });
    if (!response.ok) {
        throw new Error(`Failed to load logs (${response.status})`);
    }
    const data = await response.json();
    return data.logs ?? [];
}

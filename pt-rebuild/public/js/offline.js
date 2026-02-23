/**
 * Offline Manager - IndexedDB Read Cache
 *
 * Provides a local IndexedDB cache of server data for offline reading.
 * The active offline write/sync system is in index.html (localStorage
 * queue + syncOfflineQueue() → POST /api/logs per item). This file
 * handles read-only caching only.
 *
 * IndexedDB Stores:
 * - exercises: Read-only cache of exercise library
 * - programs: Read-only cache of patient dosage assignments
 * - activity_logs: Read-only cache of recent logs (last 90 days)
 */

const DB_NAME = 'pt_tracker_offline';
const DB_VERSION = 2;

class OfflineManager {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize IndexedDB connection.
   * DB_VERSION bumped to 2 to drop unused queue/export/metadata stores
   * from v1 (offline_queue, auto_exports, sync_metadata).
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Exercise library cache (read-only)
        if (!db.objectStoreNames.contains('exercises')) {
          db.createObjectStore('exercises', { keyPath: 'id' });
        }

        // Patient programs cache (read-only)
        if (!db.objectStoreNames.contains('programs')) {
          const programStore = db.createObjectStore('programs', { keyPath: 'id' });
          programStore.createIndex('patient_id', 'patient_id', { unique: false });
        }

        // Activity logs cache (read-only, last 90 days)
        if (!db.objectStoreNames.contains('activity_logs')) {
          const logStore = db.createObjectStore('activity_logs', { keyPath: 'id' });
          logStore.createIndex('patient_id', 'patient_id', { unique: false });
          logStore.createIndex('performed_at', 'performed_at', { unique: false });
        }

        // Drop v1 stores that are no longer used
        for (const storeName of ['offline_queue', 'auto_exports', 'sync_metadata']) {
          if (db.objectStoreNames.contains(storeName)) {
            db.deleteObjectStore(storeName);
          }
        }
      };
    });
  }

  /**
   * Helper: Promisify IDBRequest
   */
  _promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper: Wait for transaction to complete
   */
  _waitForTransaction(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  /**
   * Hydrate cache from server (replaces all cached data).
   * Server is always source of truth.
   *
   * @param {string} authToken - Bearer token for API requests
   * @param {string} patientId - Patient UUID to scope program/log fetch
   */
  async hydrateCache(authToken, patientId) {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      // Fetch exercises
      const exercisesRes = await fetch('/api/exercises', { headers });
      if (!exercisesRes.ok) throw new Error('Failed to fetch exercises');
      const exercisesData = await exercisesRes.json();
      const exercises = exercisesData.exercises || [];

      // Fetch programs
      const programsRes = await fetch(`/api/programs?patient_id=${patientId}`, { headers });
      if (!programsRes.ok) throw new Error('Failed to fetch programs');
      const programsData = await programsRes.json();
      const programs = programsData.programs || [];

      // Fetch activity logs (last 90 days)
      const logsRes = await fetch(`/api/logs?patient_id=${patientId}`, { headers });
      if (!logsRes.ok) throw new Error('Failed to fetch logs');
      const logsData = await logsRes.json();
      const logs = logsData.logs || [];

      // Replace cache (server wins)
      const tx = this.db.transaction(['exercises', 'programs', 'activity_logs'], 'readwrite');

      // Clear and repopulate exercises
      const exerciseStore = tx.objectStore('exercises');
      exerciseStore.clear();
      for (const ex of exercises) {
        exerciseStore.put(ex);
      }

      // Clear and repopulate programs
      const programStore = tx.objectStore('programs');
      programStore.clear();
      for (const prog of programs) {
        programStore.put(prog);
      }

      // Clear and repopulate activity logs
      const logStore = tx.objectStore('activity_logs');
      logStore.clear();
      for (const log of logs) {
        logStore.put(log);
      }

      await this._waitForTransaction(tx);

      return { success: true };

    } catch (error) {
      console.error('Cache hydration failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get exercises from cache
   * @returns {Promise<Array>}
   */
  async getCachedExercises() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['exercises'], 'readonly');
      const store = tx.objectStore('exercises');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get programs from cache
   * @param {string} patientId - Unused; single-patient deployment returns all programs
   * @returns {Promise<Array>}
   */
  async getCachedPrograms(patientId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['programs'], 'readonly');
      const store = tx.objectStore('programs');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get activity logs from cache
   * @param {string} patientId - Unused; single-patient deployment returns all logs
   * @returns {Promise<Array>}
   */
  async getCachedLogs(patientId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['activity_logs'], 'readonly');
      const store = tx.objectStore('activity_logs');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const offlineManager = new OfflineManager();

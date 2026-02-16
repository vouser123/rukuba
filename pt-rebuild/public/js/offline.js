/**
 * Offline Manager - IndexedDB Cache + Auto-Sync
 *
 * CRITICAL SAFETY PRINCIPLES:
 * 1. Server is ONLY source of truth
 * 2. Auto-sync when coming online + manual sync option
 * 3. Append-only queue - never modify items
 * 4. Auto-export before sync
 * 5. Server wins on conflict
 *
 * IndexedDB Stores:
 * - exercises: Read-only cache of exercise library
 * - programs: Read-only cache of patient dosage assignments
 * - activity_logs: Read-only cache of recent logs (last 90 days)
 * - offline_queue: Append-only queue (never modified, only added/removed)
 * - auto_exports: Timestamped backups before each sync
 * - sync_metadata: Last sync timestamp
 */

const DB_NAME = 'pt_tracker_offline';
const DB_VERSION = 1;

class OfflineManager {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize IndexedDB connection
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

        // Offline queue (append-only)
        if (!db.objectStoreNames.contains('offline_queue')) {
          const queueStore = db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
          queueStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // Auto-exports (backups before sync)
        if (!db.objectStoreNames.contains('auto_exports')) {
          const exportStore = db.createObjectStore('auto_exports', { keyPath: 'id', autoIncrement: true });
          exportStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Sync metadata
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata', { keyPath: 'key' });
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
   * Hydrate cache from server (replaces all cached data)
   * Server is source of truth.
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

      // Wait for transaction to complete
      await this._waitForTransaction(tx);

      // Update sync metadata
      await this.setSyncMetadata('last_sync', new Date().toISOString());

      return { success: true };

    } catch (error) {
      console.error('Cache hydration failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add item to offline queue (append-only)
   */
  async addToQueue(operation, payload) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['offline_queue'], 'readwrite');
      const store = tx.objectStore('offline_queue');

      const item = {
        operation,
        payload,
        created_at: new Date().toISOString()
      };

      const request = store.add(item);
      // TODO: Data integrity — Resolve on tx.oncomplete instead of request.onsuccess.
      // The write could still be rolled back after the promise resolves. (P1, low risk)
      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pending queue items
   */
  async getQueueItems() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['offline_queue'], 'readonly');
      const store = tx.objectStore('offline_queue');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Create auto-export backup before sync
   */
  async createAutoExport() {
    const queue = await this.getQueueItems();

    const tx = this.db.transaction(['auto_exports'], 'readwrite');
    const store = tx.objectStore('auto_exports');

    // Deep clone queue to ensure it's serializable (avoid DataCloneError)
    const backup = {
      timestamp: new Date().toISOString(),
      queue_snapshot: JSON.parse(JSON.stringify(queue))
    };

    store.add(backup);

    // Trim old exports, keep only the last 10
    const allExports = await this._promisify(store.getAll());
    if (allExports.length > 10) {
      const toDelete = allExports.slice(0, allExports.length - 10);
      for (const old of toDelete) {
        store.delete(old.id);
      }
    }

    await this._waitForTransaction(tx);
    return { success: true };
  }

  /**
   * Manual sync - THE critical function
   *
   * 1. Create auto-export backup
   * 2. Get all queue items
   * 3. POST to /api/sync
   * 4. Remove successfully processed items
   * 5. Hydrate cache from server (server wins)
   * 6. Return success/failure counts
   */
  async manualSync(authToken, patientId, onProgress) {
    try {
      // Step 1: Create auto-export
      onProgress?.('Creating backup...');
      await this.createAutoExport();

      // Step 2: Get queue
      onProgress?.('Reading queue...');
      const queue = await this.getQueueItems();

      if (queue.length === 0) {
        onProgress?.('Queue empty, hydrating cache...');
        await this.hydrateCache(authToken, patientId);
        return {
          success: true,
          processed: 0,
          failed: 0,
          message: 'No items to sync'
        };
      }

      // Step 3: POST to /api/sync
      onProgress?.(`Syncing ${queue.length} items...`);
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ queue })
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const result = await response.json();
      const processed = result.processed || [];
      const failed = result.failed || [];

      // Step 4: Remove successfully processed items
      onProgress?.('Updating queue...');

      // Build set of processed mutation IDs for O(1) lookup
      const processedIds = new Set(processed.map(item => item?.client_mutation_id).filter(Boolean));

      // Get all items, then delete processed ones
      const allItems = await this.getQueueItems();
      const tx = this.db.transaction(['offline_queue'], 'readwrite');
      const store = tx.objectStore('offline_queue');

      for (const queueItem of allItems) {
        if (processedIds.has(queueItem.payload?.client_mutation_id)) {
          store.delete(queueItem.id);
        }
      }

      await this._waitForTransaction(tx);

      // Step 5: Hydrate cache from server (server wins)
      onProgress?.('Refreshing cache...');
      await this.hydrateCache(authToken, patientId);

      return {
        success: true,
        processed: processed.length,
        failed: failed.length,
        failedItems: failed
      };

    } catch (error) {
      console.error('Manual sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get exercises from cache
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
   * Note: Since we're single-patient, just return all programs
   */
  async getCachedPrograms(patientId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['programs'], 'readonly');
      const store = tx.objectStore('programs');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get activity logs from cache
   * Note: Since we're single-patient, just return all logs
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

  /**
   * Get sync metadata value by key
   */
  async getSyncMetadata(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['sync_metadata'], 'readonly');
      const store = tx.objectStore('sync_metadata');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Set sync metadata value
   */
  async setSyncMetadata(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['sync_metadata'], 'readwrite');
      const store = tx.objectStore('sync_metadata');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get queue count (for badge display)
   */
  async getQueueCount() {
    const queue = await this.getQueueItems();
    return queue.length;
  }
}

// Export singleton instance
export const offlineManager = new OfflineManager();

// lib/offline-cache.js — shared IndexedDB cache helpers and storage adapters for offline-capable Next.js routes

const DB_NAME = 'pt_rebuild_offline';
const DB_VERSION = 4;

class OfflineCache {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('programs')) {
          db.createObjectStore('programs', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('exercises')) {
          db.createObjectStore('exercises', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('activity_logs')) {
          db.createObjectStore('activity_logs', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('ui_state')) {
          db.createObjectStore('ui_state', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('auth_state')) {
          db.createObjectStore('auth_state', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('queue_state')) {
          db.createObjectStore('queue_state', { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  async replaceAll(storeName, records) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error(`Transaction aborted for store ${storeName}`));

      store.clear();
      for (const record of records ?? []) {
        store.put(record);
      }
    });
  }

  async getAll(storeName) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  async setUiState(key, value) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['ui_state'], 'readwrite');
      const store = tx.objectStore('ui_state');

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted for ui_state'));

      store.put({ key, value });
    });
  }

  async getUiState(key, fallbackValue) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['ui_state'], 'readonly');
      const store = tx.objectStore('ui_state');
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result && Object.prototype.hasOwnProperty.call(request.result, 'value')) {
          resolve(request.result.value);
          return;
        }
        resolve(fallbackValue);
      };
      request.onerror = () => reject(request.error);
    });
  }

  cacheUsers(users) {
    return this.replaceAll('users', users ?? []);
  }

  getCachedUsers() {
    return this.getAll('users');
  }

  cachePrograms(programs) {
    return this.replaceAll('programs', programs ?? []);
  }

  getCachedPrograms() {
    return this.getAll('programs');
  }

  cacheExercises(exercises) {
    return this.replaceAll('exercises', exercises ?? []);
  }

  getCachedExercises() {
    return this.getAll('exercises');
  }

  cacheLogs(logs) {
    return this.replaceAll('activity_logs', logs ?? []);
  }

  getCachedLogs() {
    return this.getAll('activity_logs');
  }

  /** Cache the full roles API response { user_role, roles } for rehab offline fallback. */
  cacheRolesData(data) {
    return this.setUiState('rehab_roles_data', data);
  }

  /** Retrieve cached roles API response, or null if not yet cached. */
  getCachedRolesData() {
    return this.getUiState('rehab_roles_data', null);
  }

  /** Cache editor vocabularies for /program offline bootstrap. */
  cacheProgramVocabularies(data) {
    return this.setUiState('program_vocabularies', data ?? {});
  }

  /** Retrieve cached editor vocabularies, or {} if not yet cached. */
  getCachedProgramVocabularies() {
    return this.getUiState('program_vocabularies', {});
  }

  /** Cache reference-data lists used by /program selector fields. */
  cacheProgramReferenceData(data) {
    return this.setUiState('program_reference_data', data ?? { equipment: [], muscles: [], formParameters: [] });
  }

  /** Retrieve cached /program reference data, or empty lists if not yet cached. */
  getCachedProgramReferenceData() {
    return this.getUiState('program_reference_data', { equipment: [], muscles: [], formParameters: [] });
  }

  async setAuthState(key, value) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['auth_state'], 'readwrite');
      const store = tx.objectStore('auth_state');

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted for auth_state'));

      store.put({ key, value });
    });
  }

  async getAuthState(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['auth_state'], 'readonly');
      const store = tx.objectStore('auth_state');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async removeAuthState(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['auth_state'], 'readwrite');
      const store = tx.objectStore('auth_state');

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted for auth_state'));

      store.delete(key);
    });
  }

  async setQueueState(key, value) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['queue_state'], 'readwrite');
      const store = tx.objectStore('queue_state');

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted for queue_state'));

      store.put({ key, value });
    });
  }

  async getQueueState(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['queue_state'], 'readonly');
      const store = tx.objectStore('queue_state');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  async removeQueueState(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['queue_state'], 'readwrite');
      const store = tx.objectStore('queue_state');

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted for queue_state'));

      store.delete(key);
    });
  }
}

export const offlineCache = new OfflineCache();

export const authStorage = {
  async getItem(key) {
    if (typeof indexedDB === 'undefined') return null;
    return offlineCache.getAuthState(key);
  },
  async setItem(key, value) {
    if (typeof indexedDB === 'undefined') return;
    await offlineCache.setAuthState(key, value);
  },
  async removeItem(key) {
    if (typeof indexedDB === 'undefined') return;
    await offlineCache.removeAuthState(key);
  },
};

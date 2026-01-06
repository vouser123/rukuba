/**
 * Offline Queue Manager
 *
 * Queues API operations in IndexedDB when offline
 * Replays automatically when connection restored
 *
 * Phase 4: Offline Queue Implementation
 *
 * iOS/Safari Notes:
 * - Uses IndexedDB (same as Firebase, better iOS compatibility than localStorage)
 * - Handles Safari private mode gracefully
 * - Provides user feedback via offline indicator
 *
 * @module offline_queue
 */

import { ulid } from "https://cdn.jsdelivr.net/npm/ulid@2.3.0/dist/index.esm.js";

const DB_NAME = 'pt_offline_queue_db';
const DB_VERSION = 1;
const STORE_NAME = 'queue';
const MAX_QUEUE_SIZE = 1000;
const MAX_RETRIES = 3;

let dbPromise = null;

/**
 * Initialize IndexedDB
 * @returns {Promise<IDBDatabase>} Database instance
 */
function initDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[Offline Queue] IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            console.log('[Offline Queue] IndexedDB opened successfully');
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('[Offline Queue] Object store created');
            }
        };
    });

    return dbPromise;
}

/**
 * Check if browser is online
 * @returns {boolean} True if online, false if offline
 */
export function isOnline() {
    return navigator.onLine;
}

/**
 * Get current queue from IndexedDB
 * @returns {Promise<Array>} Queue array
 */
async function getQueue() {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const items = request.result || [];
                // Sort by timestamp (oldest first)
                items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                resolve(items);
            };
            request.onerror = () => {
                console.error('[Offline Queue] Failed to read queue:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('[Offline Queue] Failed to get queue:', error);
        return [];
    }
}

/**
 * Save queue item to IndexedDB
 * @param {object} item - Queue item to save
 */
async function saveQueueItem(item) {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        objectStore.put(item);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                console.log(`[Offline Queue] Saved item: ${item.id}`);
                resolve();
            };
            transaction.onerror = () => {
                console.error('[Offline Queue] Failed to save item:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('[Offline Queue] Failed to save queue item:', error);

        // Safari private mode or quota exceeded
        if (error.name === 'QuotaExceededError') {
            alert('Unable to save offline changes. Storage quota exceeded. Please clear some space or go online.');
        } else {
            alert('Unable to save offline changes. Please check browser settings (Safari private mode may not be supported).');
        }
        throw error;
    }
}

/**
 * Delete queue item from IndexedDB
 * @param {string} id - Item ID to delete
 */
async function deleteQueueItem(id) {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        objectStore.delete(id);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                console.error('[Offline Queue] Failed to delete item:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('[Offline Queue] Failed to delete queue item:', error);
        throw error;
    }
}

/**
 * Clear all queue items from IndexedDB
 */
async function clearAllQueueItems() {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        objectStore.clear();

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                console.log('[Offline Queue] All items cleared');
                resolve();
            };
            transaction.onerror = () => {
                console.error('[Offline Queue] Failed to clear queue:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('[Offline Queue] Failed to clear queue:', error);
        throw error;
    }
}

/**
 * Generate ULID for queue items
 * @returns {string} Real ULID (not prefixed)
 */
function generateQueueULID() {
    return ulid();
}

/**
 * Format queue ID for display
 * @param {string} queueId - Real ULID
 * @returns {string} Formatted display string
 */
function formatQueueIdForDisplay(queueId) {
    return `QUEUED:${queueId}`;
}

/**
 * Add operation to queue
 *
 * @param {string} operation - API function name (e.g., 'insertExerciseCompletion')
 * @param {Array} args - Function arguments
 * @returns {Promise<string>} Queue item ULID
 *
 * @throws {Error} If queue is full
 *
 * @example
 * const queueId = await enqueue('insertExerciseCompletion', [{
 *     exerciseId: '01HQXYZ...',
 *     notes: 'Felt strong',
 *     sets: [...]
 * }]);
 */
export async function enqueue(operation, args) {
    const queue = await getQueue();

    if (queue.length >= MAX_QUEUE_SIZE) {
        throw new Error('Offline queue full. Please go online to sync.');
    }

    // Add client timestamp to first argument if it's an object and doesn't have a timestamp
    // This ensures queued operations use client time during replay
    const modifiedArgs = [...args];
    if (modifiedArgs.length > 0 && typeof modifiedArgs[0] === 'object' && modifiedArgs[0] !== null) {
        if (!modifiedArgs[0]._clientTimestamp) {
            modifiedArgs[0] = {
                ...modifiedArgs[0],
                _clientTimestamp: new Date().toISOString()
            };
        }
    }

    const queueItem = {
        id: generateQueueULID(),
        operation,
        args: modifiedArgs,
        timestamp: new Date().toISOString(),
        retries: 0
    };

    await saveQueueItem(queueItem);

    // Update UI indicator
    updateOfflineIndicator(queue.length + 1);

    console.log('[Offline Queue] Queued:', operation, queueItem.id);
    return queueItem.id;
}

/**
 * Replay all queued operations
 *
 * Called automatically when connection restored
 * Processes queue sequentially, removing successful operations
 *
 * @param {object} apiModule - API module with functions to call
 * @returns {Promise<object>} Results summary {success, failed, retrying}
 *
 * @example
 * import * as ptDataAPI from './pt_data_api.js';
 * const results = await replayQueue(ptDataAPI);
 */
export async function replayQueue(apiModule) {
    const queue = await getQueue();

    if (queue.length === 0) {
        console.log('[Offline Queue] No items to replay');
        return { success: 0, failed: 0, retrying: 0 };
    }

    console.log(`[Offline Queue] Replaying ${queue.length} operations...`);
    updateOfflineIndicator(queue.length, 'syncing');

    const results = { success: 0, failed: 0, retrying: 0 };

    for (const item of queue) {
        try {
            // Get unwrapped version of function (without offline queue wrapper)
            const fnName = item.operation + 'Internal';
            const fn = apiModule[fnName] || apiModule[item.operation];

            if (!fn || typeof fn !== 'function') {
                throw new Error(`Unknown operation: ${item.operation}`);
            }

            // Call API function with queued arguments
            await fn(...item.args);
            results.success++;

            // Delete successful item from queue
            await deleteQueueItem(item.id);

            console.log(`[Offline Queue] Replayed successfully: ${item.operation} (${item.id})`);

        } catch (error) {
            console.error('[Offline Queue] Replay failed:', item, error);
            item.retries++;

            // Retry up to MAX_RETRIES times
            if (item.retries < MAX_RETRIES) {
                // Update item with incremented retry count
                await saveQueueItem(item);
                results.retrying++;
            } else {
                // Max retries exceeded, delete item
                await deleteQueueItem(item.id);
                results.failed++;
                console.error(`[Offline Queue] Max retries exceeded for ${item.id}, discarding`);
            }
        }
    }

    // Get updated queue size
    const remainingQueue = await getQueue();

    // Notify user
    if (remainingQueue.length === 0) {
        updateOfflineIndicator(0);
        showSyncNotification(`✅ Synced ${results.success} changes successfully!`);
    } else {
        updateOfflineIndicator(remainingQueue.length);
        showSyncNotification(
            `⚠️ Synced ${results.success} changes. ` +
            `${results.failed} failed permanently. ` +
            `${results.retrying} will retry.`
        );
    }

    console.log('[Offline Queue] Replay complete:', results);
    return results;
}

/**
 * Wrap API function to automatically queue when offline
 *
 * Returns a new function that checks online status:
 * - If online: calls original function directly
 * - If offline: queues operation and returns mock response
 *
 * @param {Function} apiFunction - Original API function
 * @param {string} operationName - Function name for queuing
 * @returns {Function} Wrapped function
 *
 * @example
 * const insertExerciseCompletion = withOfflineQueue(
 *     insertExerciseCompletionInternal,
 *     'insertExerciseCompletion'
 * );
 */
export function withOfflineQueue(apiFunction, operationName) {
    return async function(...args) {
        if (isOnline()) {
            // Online - call directly
            return await apiFunction(...args);
        } else {
            // Offline - queue for later
            const queueId = await enqueue(operationName, args);
            // Return real ULID (formatQueueIdForDisplay is only for UI display)
            return queueId;
        }
    };
}

/**
 * Get queue size
 * @returns {Promise<number>} Number of items in queue
 */
export async function getQueueSize() {
    const queue = await getQueue();
    return queue.length;
}

/**
 * Clear entire queue
 * WARNING: This will discard all queued operations
 */
export async function clearQueue() {
    await clearAllQueueItems();
    updateOfflineIndicator(0);
    console.log('[Offline Queue] Queue cleared');
}

/**
 * Update offline indicator UI
 *
 * Updates the offline indicator element with current queue state
 * Shows/hides indicator based on queue size and sync state
 *
 * @param {number} queueSize - Number of items in queue
 * @param {string} state - State: 'offline' | 'syncing' | 'online'
 */
function updateOfflineIndicator(queueSize, state = 'offline') {
    const indicator = document.getElementById('offline-indicator');
    if (!indicator) return;

    if (queueSize > 0) {
        indicator.style.display = 'block';

        if (state === 'syncing') {
            indicator.innerHTML = `🔄 Syncing ${queueSize} changes...`;
            indicator.style.background = 'var(--ios-orange, #FF9500)';
        } else {
            indicator.innerHTML = `📴 Offline - Changes saved locally (Queue: <span id="queue-count">${queueSize}</span>)`;
            indicator.style.background = 'var(--ios-red, #FF3B30)';
        }
    } else {
        indicator.style.display = 'none';
    }
}

/**
 * Show sync notification
 * @param {string} message - Notification message
 */
function showSyncNotification(message) {
    // Try to use transaction toast if available
    const toast = document.getElementById('transaction-toast');
    if (toast) {
        const messageSpan = document.getElementById('transaction-message');
        const idSpan = document.getElementById('transaction-id');

        if (messageSpan) messageSpan.textContent = '';
        if (idSpan) idSpan.textContent = message;

        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
    } else {
        // Fallback to alert
        alert(message);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Listen for online/offline events
 * Automatically triggers replay when connection restored
 */
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[Offline Queue] Connection restored');

        // Dispatch custom event for app to handle
        // App should listen for this and call replayQueue(ptDataAPI)
        window.dispatchEvent(new CustomEvent('offlinequeue:online'));
    });

    window.addEventListener('offline', async () => {
        console.log('[Offline Queue] Connection lost');
        const queue = await getQueue();
        updateOfflineIndicator(queue.length);
    });

    // Initialize on load
    window.addEventListener('load', async () => {
        const queue = await getQueue();
        if (queue.length > 0) {
            console.log(`[Offline Queue] Found ${queue.length} queued items on load`);
            updateOfflineIndicator(queue.length);
        }
    });
}

/**
 * Export default object with all functions
 */
export default {
    isOnline,
    enqueue,
    replayQueue,
    withOfflineQueue,
    getQueueSize,
    clearQueue
};

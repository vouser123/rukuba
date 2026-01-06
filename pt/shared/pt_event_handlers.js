/**
 * PT Event Handlers - Unified event binding for iOS/Safari compatibility
 *
 * NO onclick attributes - use pointerup + keydown pattern
 * All interactive elements get 44px minimum touch targets
 *
 * @module pt_event_handlers
 *
 * Phase 3: Unified PT Editor
 * Critical Constraint: iOS/Safari does not reliably support onclick attributes
 */

/**
 * Bind action handlers to elements with data-action attribute
 *
 * iOS-safe event binding: pointerup + keydown (no onclick)
 * Automatically validates touch target sizes (44px minimum)
 *
 * @param {Element} root - Root element to search within (default: document)
 * @param {object} actionMap - Map of action names to handler functions
 *
 * @example
 * bindActionHandlers(document.body, {
 *     saveExercise: handleSaveExercise,
 *     deleteExercise: handleDeleteExercise
 * });
 *
 * HTML:
 * <button data-action="saveExercise">Save</button>
 */
export function bindActionHandlers(root = document, actionMap = {}) {
    const elements = root.querySelectorAll('[data-action]');

    elements.forEach(el => {
        // Prevent double-binding
        if (el.dataset.pointerBound === 'true') {
            return;
        }
        el.dataset.pointerBound = 'true';

        const actionName = el.dataset.action;
        const handler = actionMap[actionName];

        if (!handler) {
            console.warn(`[Event Handlers] No handler for action: ${actionName}`);
            return;
        }

        // Validate touch target size (iOS requirement: 44px minimum)
        validateTouchTarget(el);

        // iOS-safe event binding: pointerup + keydown
        el.addEventListener('pointerup', (e) => {
            e.preventDefault();
            handler(e);
        });

        // Keyboard accessibility (Enter or Space)
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler(e);
            }
        });
    });

    console.log(`[Event Handlers] Bound ${elements.length} action handlers`);
}

/**
 * Validate touch target meets iOS 44px minimum
 *
 * Auto-adjusts padding if target is too small
 * Logs warning to console for developer awareness
 *
 * @param {Element} el - Element to validate
 */
export function validateTouchTarget(el) {
    const rect = el.getBoundingClientRect();
    const minSize = 44;

    if (rect.width < minSize || rect.height < minSize) {
        console.warn(
            `[Touch Target] Element too small (${rect.width}x${rect.height}): ${el.dataset.action || el.id}`,
            el
        );

        // Auto-add padding if needed
        if (!el.classList.contains('touch-target')) {
            el.classList.add('touch-target');
        }
    }
}

/**
 * Show transaction ID toast (iOS style, bottom of screen)
 *
 * Displays transaction ID with copy button for user confirmation
 * Auto-hides after 5 seconds
 *
 * @param {string} txId - Transaction ID (ULID)
 * @param {object} options - Toast options
 * @param {number} options.duration - Auto-hide duration in ms (default: 5000)
 * @param {string} options.message - Custom message prefix (default: "Saved:")
 *
 * @example
 * showTransactionToast('01HQXYZ123ABC', { message: 'Exercise created:' });
 *
 * iOS/Safari Notes:
 * - Uses fixed positioning with safe-area-inset for notch/home indicator
 * - Haptic feedback triggers on show (if available)
 */
export function showTransactionToast(txId, options = {}) {
    const {
        duration = 5000,
        message = 'Saved:'
    } = options;

    const toast = document.getElementById('transaction-toast');
    if (!toast) {
        console.error('[Toast] Transaction toast element not found in DOM');
        return;
    }

    const idSpan = document.getElementById('transaction-id');
    const messageSpan = document.getElementById('transaction-message');

    if (messageSpan) {
        messageSpan.textContent = message;
    }

    if (idSpan) {
        idSpan.textContent = txId;
    }

    toast.classList.add('show');
    toast.style.display = 'block';

    // Haptic feedback (iOS only)
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
    }

    // Auto-hide after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300); // Wait for fade-out animation
    }, duration);

    console.log(`[Toast] Showing transaction ID: ${txId}`);
}

/**
 * Copy transaction ID to clipboard
 *
 * Triggered by clicking "Copy" button in transaction toast
 * Shows confirmation alert on success
 *
 * iOS/Safari Notes:
 * - Uses Clipboard API (supported on iOS 13.4+)
 * - Requires secure context (HTTPS or localhost)
 */
export function copyTransactionId() {
    const txId = document.getElementById('transaction-id');
    if (!txId) {
        console.error('[Clipboard] Transaction ID element not found');
        return;
    }

    const text = txId.textContent;
    if (!text) {
        console.warn('[Clipboard] No transaction ID to copy');
        return;
    }

    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('[Clipboard] Transaction ID copied:', text);

            // Update toast to show success
            const toast = document.getElementById('transaction-toast');
            const messageSpan = document.getElementById('transaction-message');

            if (messageSpan) {
                const originalText = messageSpan.textContent;
                messageSpan.textContent = 'Copied!';

                // Reset after 1.5 seconds
                setTimeout(() => {
                    messageSpan.textContent = originalText;
                }, 1500);
            }

            // Haptic feedback
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(25);
            }
        })
        .catch(err => {
            console.error('[Clipboard] Failed to copy:', err);
            alert('Failed to copy transaction ID. Please try again.');
        });
}

/**
 * Long-press handler (for pocket mode, etc.)
 *
 * Triggers callback after user holds down for specified duration
 * Prevents accidental activations with visual feedback
 *
 * @param {Element} el - Element to bind to
 * @param {Function} callback - Handler function
 * @param {number} duration - Long press duration in ms (default: 700)
 *
 * @example
 * bindLongPress(button, () => {
 *     console.log('Long press detected!');
 * }, 1000);
 *
 * iOS/Safari Notes:
 * - Uses touchstart/touchend for better iOS performance
 * - Prevents context menu on long press
 */
export function bindLongPress(el, callback, duration = 700) {
    let timer = null;
    let pressing = false;

    const startHandler = (e) => {
        pressing = true;
        el.classList.add('pressing');

        timer = setTimeout(() => {
            if (pressing) {
                callback(e);

                // Haptic feedback
                if (window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate([50, 100, 50]);
                }
            }
        }, duration);
    };

    const endHandler = () => {
        pressing = false;
        el.classList.remove('pressing');

        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    // Touch events (iOS optimized)
    el.addEventListener('touchstart', startHandler, { passive: true });
    el.addEventListener('touchend', endHandler, { passive: true });
    el.addEventListener('touchcancel', endHandler, { passive: true });

    // Pointer events (desktop fallback)
    el.addEventListener('pointerdown', startHandler);
    el.addEventListener('pointerup', endHandler);
    el.addEventListener('pointercancel', endHandler);

    // Prevent context menu on long press (iOS)
    el.addEventListener('contextmenu', (e) => {
        if (pressing) {
            e.preventDefault();
        }
    });

    console.log(`[Long Press] Bound to element:`, el);
}

/**
 * Show confirmation dialog (iOS action sheet style)
 *
 * Displays bottom action sheet for destructive actions
 * Returns promise that resolves to true/false
 *
 * @param {string} message - Confirmation message
 * @param {object} options - Dialog options
 * @param {string} options.confirmText - Confirm button text (default: "Confirm")
 * @param {string} options.cancelText - Cancel button text (default: "Cancel")
 * @param {boolean} options.destructive - Style as destructive action (default: true)
 * @returns {Promise<boolean>} True if confirmed, false if cancelled
 *
 * @example
 * const confirmed = await showConfirmDialog('Delete this exercise?', {
 *     confirmText: 'Delete',
 *     destructive: true
 * });
 *
 * if (confirmed) {
 *     // Delete exercise
 * }
 */
export function showConfirmDialog(message, options = {}) {
    const {
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        destructive = true
    } = options;

    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'action-sheet-backdrop';

        const sheet = document.createElement('div');
        sheet.className = 'action-sheet';
        sheet.innerHTML = `
            <div class="action-sheet-content">
                <div class="action-sheet-message">${message}</div>
                <button class="action-sheet-button ${destructive ? 'destructive' : ''}" data-action="confirm">
                    ${confirmText}
                </button>
            </div>
            <button class="action-sheet-cancel" data-action="cancel">${cancelText}</button>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(sheet);

        // Animate in
        setTimeout(() => {
            backdrop.classList.add('show');
            sheet.classList.add('show');
        }, 10);

        // Event handlers
        const confirmBtn = sheet.querySelector('[data-action="confirm"]');
        const cancelBtn = sheet.querySelector('[data-action="cancel"]');

        const close = (confirmed) => {
            backdrop.classList.remove('show');
            sheet.classList.remove('show');

            setTimeout(() => {
                backdrop.remove();
                sheet.remove();
            }, 300);

            resolve(confirmed);
        };

        confirmBtn.addEventListener('pointerup', () => close(true));
        cancelBtn.addEventListener('pointerup', () => close(false));
        backdrop.addEventListener('pointerup', () => close(false));
    });
}

/**
 * Inject required CSS styles for event handlers
 *
 * Adds touch target sizing, toast animations, action sheets, etc.
 * Called automatically on module load
 */
function injectStyles() {
    const styles = `
        /* Touch Targets - iOS 44px minimum */
        .touch-target {
            min-width: 44px;
            min-height: 44px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }

        /* Transaction Toast - iOS style */
        #transaction-toast {
            position: fixed;
            bottom: calc(20px + env(safe-area-inset-bottom));
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            max-width: 80%;
            text-align: center;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
            display: none;
        }

        #transaction-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        #transaction-toast button {
            margin-left: 10px;
            background: var(--ios-blue, #007AFF);
            border: none;
            color: white;
            padding: 4px 8px;
            border-radius: 8px;
            font-size: 12px;
            cursor: pointer;
            font-weight: 600;
        }

        /* Long Press Feedback */
        .pressing {
            opacity: 0.6;
            transform: scale(0.98);
            transition: all 0.1s ease;
        }

        /* Action Sheet - iOS style */
        .action-sheet-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 9998;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .action-sheet-backdrop.show {
            opacity: 1;
        }

        .action-sheet {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            transform: translateY(100%);
            transition: transform 0.3s ease;
            padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
            background: transparent;
        }

        .action-sheet.show {
            transform: translateY(0);
        }

        .action-sheet-content {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 14px;
            margin-bottom: 8px;
            overflow: hidden;
        }

        .action-sheet-message {
            padding: 16px;
            text-align: center;
            font-size: 13px;
            color: #666;
            border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
        }

        .action-sheet-button {
            width: 100%;
            padding: 16px;
            border: none;
            background: transparent;
            font-size: 20px;
            color: var(--ios-blue, #007AFF);
            cursor: pointer;
            font-weight: 400;
        }

        .action-sheet-button.destructive {
            color: var(--ios-red, #FF3B30);
            font-weight: 600;
        }

        .action-sheet-cancel {
            width: 100%;
            padding: 16px;
            border: none;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 14px;
            font-size: 20px;
            color: var(--ios-blue, #007AFF);
            cursor: pointer;
            font-weight: 600;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            .action-sheet-content,
            .action-sheet-cancel {
                background: rgba(28, 28, 30, 0.95);
            }

            .action-sheet-message {
                color: #999;
            }

            .action-sheet-button {
                color: var(--ios-blue, #0A84FF);
            }

            .action-sheet-cancel {
                color: var(--ios-blue, #0A84FF);
            }
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    console.log('[Event Handlers] CSS styles injected');
}

// Auto-inject styles on module load
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }
}

/**
 * Export default object with all functions
 */
export default {
    bindActionHandlers,
    validateTouchTarget,
    showTransactionToast,
    copyTransactionId,
    bindLongPress,
    showConfirmDialog
};

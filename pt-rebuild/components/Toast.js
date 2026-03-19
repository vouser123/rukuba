// components/Toast.js — floating toast notification overlay
// Matches static app toast mechanics: position:fixed, slide-up from bottom, success/error variants.
import styles from './Toast.module.css';

/**
 * Floating toast overlay. Renders nothing when message is empty.
 * @param {string} message - text to display
 * @param {string} type    - '' (default), 'success', or 'error'
 * @param {boolean} visible - true while toast is showing; false triggers fade-out via CSS
 */
export default function Toast({ message, type = '', visible = false }) {
    if (!message) return null;

    const className = [
        styles.toast,
        visible ? styles.show : '',
        type === 'success' ? styles.success : '',
        type === 'error' ? styles.error : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            className={className}
            role={type === 'error' ? 'alert' : 'status'}
            aria-live={type === 'error' ? 'assertive' : 'polite'}
        >
            {message}
        </div>
    );
}

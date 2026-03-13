// components/PocketModeOverlay.js — full-screen pocket interaction overlay for the tracker logger

import { useRef } from 'react';
import styles from './PocketModeOverlay.module.css';

export default function PocketModeOverlay({
    isOpen,
    label,
    meta,
    hint,
    onClose,
    onTap,
    onLongPress,
    longPressEnabled = false,
}) {
    const longPressRef = useRef(null);
    const longPressActiveRef = useRef(false);

    if (!isOpen) return null;

    function clearLongPress() {
        if (longPressRef.current) {
            clearTimeout(longPressRef.current);
            longPressRef.current = null;
        }
    }

    function handlePointerDown() {
        longPressActiveRef.current = false;
        if (!longPressEnabled || !onLongPress) return;
        clearLongPress();
        longPressRef.current = setTimeout(() => {
            longPressActiveRef.current = true;
            onLongPress();
        }, 700);
    }

    function handlePointerUp() {
        clearLongPress();
        if (longPressActiveRef.current) {
            longPressActiveRef.current = false;
            return;
        }
        onTap?.();
    }

    return (
        <div className={styles.overlay}>
            <button
                type="button"
                className={styles.closeBtn}
                onPointerUp={onClose}
                aria-label="Exit pocket mode"
            >
                ✕
            </button>
            <button
                type="button"
                className={styles.pad}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={clearLongPress}
                onPointerLeave={clearLongPress}
            >
                <span className={styles.label}>{label}</span>
                <span className={styles.meta}>{meta}</span>
                <span className={styles.hint}>{hint}</span>
            </button>
        </div>
    );
}

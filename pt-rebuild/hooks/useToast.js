// hooks/useToast.js — floating toast notification state for the tracker page
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Manages floating toast state. Provides showToast(message, type, duration).
 * The toast animates in immediately, fades out after duration, then clears.
 * @returns {{ showToast: Function, toastMessage: string, toastType: string, toastVisible: boolean }}
 */
export function useToast() {
    const [toast, setToast] = useState({ message: '', type: '', visible: false });
    const showTimerRef = useRef(null);
    const hideTimerRef = useRef(null);
    const clearTimerRef = useRef(null);

    const showToast = useCallback((message, type = '', duration = 3000) => {
        // Cancel any in-flight timers so a new toast replaces the current one immediately
        if (showTimerRef.current) clearTimeout(showTimerRef.current);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

        setToast({ message, type, visible: false });

        // Match the staged static behavior: insert first, then animate in shortly after mount.
        showTimerRef.current = window.setTimeout(() => {
            setToast((prev) => ({ ...prev, visible: true }));
        }, 10);

        // After duration, begin fade-out
        hideTimerRef.current = window.setTimeout(() => {
            setToast((prev) => ({ ...prev, visible: false }));
            // After CSS transition (300ms), clear message so component unmounts cleanly
            clearTimerRef.current = window.setTimeout(() => {
                setToast({ message: '', type: '', visible: false });
            }, 300);
        }, duration);
    }, []);

    // Clean up on unmount
    useEffect(() => () => {
        if (showTimerRef.current) clearTimeout(showTimerRef.current);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    }, []);

    return {
        showToast,
        toastMessage: toast.message,
        toastType: toast.type,
        toastVisible: toast.visible,
    };
}

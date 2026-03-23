// hooks/useEmailNotifications.js — email notification toggle for the current user; optimistic update with API revert on failure

import { useEffect, useState } from 'react';
import { patchEmailNotifications } from '../lib/users';

/**
 * Manages the email notification enabled state for the current user.
 * Initializes from the server value once userCtx resolves, then allows
 * optimistic toggle with revert on API failure.
 *
 * @param {{ token: string|null, initialEnabled: boolean, loading: boolean }} params
 * @returns {{ emailEnabled: boolean, handleEmailToggle: (enabled: boolean) => Promise<void> }}
 */
export function useEmailNotifications({ token, initialEnabled, loading }) {
    const [emailEnabled, setEmailEnabled] = useState(true);

    // Sync to server value once userCtx finishes loading.
    useEffect(() => {
        if (!loading) setEmailEnabled(initialEnabled);
    }, [initialEnabled, loading]);

    async function handleEmailToggle(enabled) {
        setEmailEnabled(enabled); // optimistic update
        try {
            await patchEmailNotifications(token, enabled);
        } catch {
            setEmailEnabled(!enabled); // revert on API error
        }
    }

    return { emailEnabled, handleEmailToggle };
}

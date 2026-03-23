import { useEffect, useRef } from 'react';

/**
 * useTrackerReconnectRecovery — route-level reconnect policy for the tracker shell.
 *
 * Responsibilities:
 * - attempt queue sync immediately when connectivity returns
 * - refresh tracker data only when the picker shell is safe to refresh
 * - defer that full refresh while logger/history flows are active
 *
 * @param {object} options
 * @param {boolean} options.enabled
 * @param {boolean} options.canRefreshNow
 * @param {Function} options.sync
 * @param {Function} options.reload
 */
export function useTrackerReconnectRecovery({
    enabled,
    canRefreshNow,
    sync,
    reload,
}) {
    const pendingRefreshRef = useRef(false);
    const reloadingRef = useRef(false);

    useEffect(() => {
        if (!enabled || !canRefreshNow || !pendingRefreshRef.current || reloadingRef.current) return;

        pendingRefreshRef.current = false;
        reloadingRef.current = true;
        void reload().finally(() => {
            reloadingRef.current = false;
        });
    }, [canRefreshNow, enabled, reload]);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return undefined;

        async function handleOnline() {
            const syncResult = await sync();
            const hasSuccessfulSync = (syncResult?.succeeded ?? 0) > 0;
            const needsRefresh = hasSuccessfulSync || canRefreshNow;

            if (!needsRefresh) return;

            if (canRefreshNow && !reloadingRef.current) {
                reloadingRef.current = true;
                try {
                    await reload();
                    pendingRefreshRef.current = false;
                } finally {
                    reloadingRef.current = false;
                }
                return;
            }

            pendingRefreshRef.current = true;
        }

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [canRefreshNow, enabled, reload, sync]);
}

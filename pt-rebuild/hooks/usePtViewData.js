/**
 * hooks/usePtViewData.js — Loads and caches rehab logs and programs for the
 * pt-view history dashboard.
 *
 * Accepts { token, patientId } — user identity is resolved upstream by
 * useUserContext, which also handles the users fetch and cache. This hook
 * focuses solely on logs and programs.
 *
 * Waits for patientId to be non-null before fetching (it arrives async from
 * useUserContext). Falls back to offline cache when the network is unavailable.
 */
import { useEffect, useState } from 'react';
import { fetchLogs, fetchPrograms } from '../lib/pt-view';
import { offlineCache } from '../lib/offline-cache';

function getDefaultState() {
    return {
        logs: [],
        programs: [],
        dataError: null,
        offlineNotice: null,
    };
}

/**
 * @param {{ token: string|null, patientId: string|null }} params
 * @returns {{ logs: Array, programs: Array, dataError: string|null, offlineNotice: string|null }}
 */
export function usePtViewData({ token, patientId }) {
    const [state, setState] = useState(getDefaultState);

    useEffect(() => {
        // Wait for upstream useUserContext to resolve patientId.
        // When token is null (signed out), clear cached logs/programs.
        if (!token || !patientId) {
            if (!token) {
                void offlineCache.init()
                    .then(() => Promise.all([
                        offlineCache.clearPrograms(),
                        offlineCache.clearLogs(),
                    ]))
                    .catch((err) => console.error('usePtViewData cache clear failed:', err));
            }
            setState(getDefaultState());
            return;
        }

        let cancelled = false;

        function applyState(nextState) {
            if (!cancelled) setState(nextState);
        }

        async function loadFromCache() {
            const [logsData, programsData] = await Promise.all([
                offlineCache.getCachedLogs(),
                offlineCache.getCachedPrograms(),
            ]);
            applyState({
                logs: logsData ?? [],
                programs: (programsData ?? []).filter((p) => !p.exercises?.archived),
                dataError: null,
                offlineNotice: 'Offline - showing cached data.',
            });
        }

        async function load() {
            try {
                await offlineCache.init();
                const [logsData, programsData] = await Promise.all([
                    fetchLogs(token, patientId),
                    fetchPrograms(token, patientId),
                ]);

                await Promise.all([
                    offlineCache.cacheLogs(logsData),
                    offlineCache.cachePrograms(programsData),
                ]);

                applyState({
                    logs: logsData ?? [],
                    programs: (programsData ?? []).filter((p) => !p.exercises?.archived),
                    dataError: null,
                    offlineNotice: null,
                });
            } catch (error) {
                try {
                    await loadFromCache();
                } catch {
                    applyState({ ...getDefaultState(), dataError: error.message });
                }
            }
        }

        void load();
        return () => { cancelled = true; };
    }, [token, patientId]);

    return state;
}

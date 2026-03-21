// hooks/usePtViewData.js — loads and caches pt-view bootstrap data for the history dashboard
import { useEffect, useState } from 'react';
import { fetchLogs, fetchPrograms } from '../lib/pt-view';
import { fetchUsers, resolvePatientScopedUserContext } from '../lib/users';
import { offlineCache } from '../lib/offline-cache';

function getDefaultState() {
    return {
        logs: [],
        programs: [],
        profileId: null,
        recipientId: null,
        emailEnabled: true,
        userRole: 'patient',
        dataError: null,
        offlineNotice: null,
    };
}

export function usePtViewData(session) {
    const [state, setState] = useState(getDefaultState);

    useEffect(() => {
        let cancelled = false;

        function applyState(nextState) {
            if (!cancelled) {
                setState(nextState);
            }
        }

        async function applyBootstrap(usersData, logsData, programsData, notice = null) {
            const { currentUser, fallbackRecipientId } = resolvePatientScopedUserContext(
                usersData,
                session.user.id
            );

            applyState({
                logs: logsData ?? [],
                programs: (programsData ?? []).filter((program) => !program.exercises?.archived),
                profileId: currentUser?.id ?? null,
                recipientId: fallbackRecipientId,
                emailEnabled: currentUser?.email_notifications_enabled ?? true,
                userRole: currentUser?.role ?? 'patient',
                dataError: null,
                offlineNotice: notice,
            });
        }

        async function loadFromCache() {
            await offlineCache.init();
            const [usersData, logsData, programsData] = await Promise.all([
                offlineCache.getCachedUsers(),
                offlineCache.getCachedLogs(),
                offlineCache.getCachedPrograms(),
            ]);

            if (!usersData.length) {
                throw new Error('No cached pt-view data available offline.');
            }

            await applyBootstrap(usersData, logsData, programsData, 'Offline - showing cached data.');
        }

        async function load() {
            if (!session) {
                if (cancelled) {
                    return;
                }

                void offlineCache.init().then(() => Promise.all([
                    offlineCache.clearStore('users'),
                    offlineCache.clearPrograms(),
                    offlineCache.clearLogs(),
                ])).catch((cacheError) => {
                    console.error('usePtViewData cache clear failed:', cacheError);
                });

                applyState(getDefaultState());
                return;
            }

            try {
                await offlineCache.init();
                const usersData = await fetchUsers(session.access_token);
                await offlineCache.cacheUsers(usersData);

                const { patientUser } = resolvePatientScopedUserContext(usersData, session.user.id);
                const [logsData, programsData] = await Promise.all([
                    fetchLogs(session.access_token, patientUser.id),
                    fetchPrograms(session.access_token, patientUser.id),
                ]);

                await Promise.all([
                    offlineCache.cacheLogs(logsData),
                    offlineCache.cachePrograms(programsData),
                ]);

                await applyBootstrap(usersData, logsData, programsData);
            } catch (error) {
                try {
                    await loadFromCache();
                } catch {
                    applyState({
                        ...getDefaultState(),
                        dataError: error.message,
                    });
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [session]);

    return {
        ...state,
        setEmailEnabled: (value) => {
            setState((current) => ({ ...current, emailEnabled: value }));
        },
    };
}

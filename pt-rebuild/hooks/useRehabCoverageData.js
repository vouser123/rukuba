// hooks/useRehabCoverageData.js — loads rehab coverage bootstrap data with offline fallback
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildCoverageData } from '../lib/rehab-coverage';
import { offlineCache } from '../lib/offline-cache';

function getLoadErrorMessage(error) {
    return error instanceof Error ? error.message : 'Failed to load coverage data.';
}

export function useRehabCoverageData(accessToken) {
    const [userRole, setUserRole] = useState('patient');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [coverageResult, setCoverageResult] = useState(null);
    const [offlineNotice, setOfflineNotice] = useState(null);
    const hadAuthRef = useRef(false);

    const reload = useCallback(async () => {
        if (!accessToken) return;

        setLoading(true);
        setError(null);
        setOfflineNotice(null);

        try {
            const headers = { Authorization: `Bearer ${accessToken}` };
            const [logsRes, rolesRes] = await Promise.all([
                fetch('/api/logs?limit=1000', { headers }),
                fetch('/api/roles', { headers }),
            ]);
            if (!logsRes.ok) throw new Error(`Logs API: ${logsRes.status}`);
            if (!rolesRes.ok) throw new Error(`Roles API: ${rolesRes.status}`);

            const [logsData, rolesData] = await Promise.all([
                logsRes.json(),
                rolesRes.json(),
            ]);

            void offlineCache.cacheLogs(logsData.logs || []);
            void offlineCache.cacheRolesData(rolesData);

            setUserRole(rolesData.user_role || 'patient');
            setCoverageResult(buildCoverageData(logsData.logs || [], rolesData.roles || []));
        } catch (err) {
            console.error('useRehabCoverageData load failed:', err);
            try {
                await offlineCache.init();
                const [cachedLogs, cachedRoles] = await Promise.all([
                    offlineCache.getCachedLogs(),
                    offlineCache.getCachedRolesData(),
                ]);
                if (!cachedRoles) throw new Error('No cached coverage data available offline.');
                setUserRole(cachedRoles.user_role || 'patient');
                setCoverageResult(buildCoverageData(cachedLogs || [], cachedRoles.roles || []));
                setOfflineNotice('Offline — showing cached data.');
            } catch (cacheError) {
                console.error('useRehabCoverageData cache fallback failed:', cacheError);
                setError(getLoadErrorMessage(err));
            }
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        if (typeof window !== 'undefined' && accessToken) {
            void offlineCache.init().catch((cacheError) => {
                console.error('useRehabCoverageData cache init failed:', cacheError);
            });
        }

        if (!accessToken) {
            if (hadAuthRef.current && typeof window !== 'undefined') {
                void Promise.all([
                    offlineCache.clearLogs(),
                    offlineCache.removeUiState('rehab_roles_data'),
                ]).catch((cacheError) => {
                    console.error('useRehabCoverageData cache clear failed:', cacheError);
                });
            }

            setUserRole('patient');
            setCoverageResult(null);
            setOfflineNotice(null);
            setLoading(false);
            setError(null);
            hadAuthRef.current = false;
            return;
        }

        hadAuthRef.current = true;
        reload();
    }, [accessToken, reload]);

    return {
        userRole,
        loading,
        error,
        coverageResult,
        offlineNotice,
        reload,
    };
}

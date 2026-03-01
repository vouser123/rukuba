/**
 * Rehab Coverage Analysis — Next.js page (DN-033).
 * Replaces public/rehab_coverage.html.
 * public/rehab_coverage.html stays live until this is verified in production.
 *
 * Architecture:
 *   useAuth()     — session, loading, signIn from hooks/useAuth.js
 *   <AuthForm />  — sign-in form from components/AuthForm.js
 *   <NavMenu />   — navigation sidebar from components/NavMenu.js
 *   supabase      — shared client from lib/supabase.js (used only for signOut here)
 *   buildCoverageData() — pure calculation from lib/rehab-coverage.js
 *
 * No window.*, no Script tags, no useRef plumbing to bridge React and globals.
 * CSS: page styles in rehab.module.css; component styles are self-contained.
 */
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import NavMenu from '../components/NavMenu';
import AuthForm from '../components/AuthForm';
import CoverageSummary from '../components/CoverageSummary';
import CoverageMatrix from '../components/CoverageMatrix';
import { buildCoverageData, colorScoreToRGB, COVERAGE_CONSTANTS } from '../lib/rehab-coverage';
import styles from './rehab.module.css';

export default function RehabCoverage() {
    const { session, loading: authLoading, signIn } = useAuth();

    // User's role — determines which nav items are visible
    const [userRole, setUserRole] = useState('patient');

    // Data loading state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Coverage data returned by buildCoverageData()
    const [coverageResult, setCoverageResult] = useState(null); // { coverageData, summary }

    // UI interaction state — accordion open/close
    const [collapsedRegions, setCollapsedRegions] = useState(new Set());
    const [expandedCapacities, setExpandedCapacities] = useState(new Set());
    const [legendExpanded, setLegendExpanded] = useState(false);

    // =========================================================================
    // Service worker registration (done here instead of a Script tag)
    // =========================================================================
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) { refreshing = true; window.location.reload(); }
            });
        }
    }, []);

    // =========================================================================
    // Data loading
    // =========================================================================

    /** Fetch logs + roles in parallel, compute coverage data. */
    const loadData = useCallback(async (accessToken) => {
        setLoading(true);
        setError(null);
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

            setUserRole(rolesData.user_role || 'patient');
            const result = buildCoverageData(logsData.logs || [], rolesData.roles || []);
            setCoverageResult(result);
        } catch (err) {
            console.error('loadData failed:', err);
            setError(err.message || 'Failed to load coverage data.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load data when session becomes available; clear data on sign-out
    useEffect(() => {
        if (session) {
            loadData(session.access_token);
        } else if (!authLoading) {
            setCoverageResult(null);
            setUserRole('patient');
        }
    }, [session, authLoading, loadData]);

    // =========================================================================
    // UI event handlers
    // =========================================================================

    function toggleRegion(region) {
        setCollapsedRegions(prev => {
            const next = new Set(prev);
            if (next.has(region)) next.delete(region);
            else next.add(region);
            return next;
        });
    }

    function toggleCapacity(key) {
        setExpandedCapacities(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    // =========================================================================
    // Render
    // =========================================================================

    return (
        <>
            <Head>
                <title>Rehab Coverage Analysis</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
                <link rel="apple-touch-icon" href="/icons/icon.svg" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-title" content="PT Tracker" />
            </Head>

            {/* Auth form — shown when not signed in (and auth check has resolved) */}
            {!session && !authLoading && (
                <AuthForm
                    title="Coverage Analysis Sign In"
                    onSignIn={signIn}
                />
            )}

            {/* Main app — shown when signed in */}
            {session && (
                <>
                    <div className={styles.header}>
                        <h1>Rehab Coverage</h1>
                        <div className={styles['header-actions']}>
                            <button
                                className={`${styles.btn} ${styles['btn-secondary']}`}
                                onPointerUp={() => loadData(session.access_token)}
                                aria-label="Refresh data"
                            >
                                ↻
                            </button>
                            {/* NavMenu renders the ☰ button + overlay + panel */}
                            <NavMenu
                                user={session.user}
                                isAdmin={userRole !== 'patient'}
                                onSignOut={() => supabase.auth.signOut()}
                                currentPage="rehab_coverage"
                                actions={[{ action: 'refresh-data', icon: '🔄', label: 'Refresh Data' }]}
                                onAction={(action) => {
                                    if (action === 'refresh-data') loadData(session.access_token);
                                }}
                            />
                        </div>
                    </div>

                    {/* Summary card */}
                    {coverageResult && <CoverageSummary summary={coverageResult.summary} />}

                    {/* Legend — collapsed by default */}
                    <div className={`${styles['legend-card']} ${legendExpanded ? styles.expanded : ''}`}>
                        <div
                            className={styles['legend-header']}
                            onPointerUp={() => setLegendExpanded(p => !p)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLegendExpanded(p => !p); } }}
                        >
                            <h4>📊 How to Read Coverage Bars</h4>
                            <span className={styles['legend-toggle']}>›</span>
                        </div>
                        <div className={styles['legend-content']}>
                            <div className={styles['legend-section']}>
                                <div className={styles['legend-section-title']}>Bar Width = 7-Day Density</div>
                                <p className={styles['legend-description']}>How consistently exercises are being done in the past week.</p>
                                <div className={styles['legend-row']}><div className={styles['legend-sample']} style={{ width: '40px', background: '#888' }} /><span>100% = All exercises done daily</span></div>
                                <div className={styles['legend-row']}><div className={styles['legend-sample']} style={{ width: '20px', background: '#888' }} /><span>50% = About half the expected volume</span></div>
                                <div className={styles['legend-row']}><div className={styles['legend-sample']} style={{ width: '4px', background: '#888' }} /><span>0% = No exercises done this week</span></div>
                            </div>
                            <div className={styles['legend-section']}>
                                <div className={styles['legend-section-title']}>Bar Color = Recency</div>
                                <p className={styles['legend-description']}>How recently the most neglected exercise was done.</p>
                                <div className={styles['legend-row']}><div className={styles['legend-sample']} style={{ background: 'rgb(52, 199, 89)' }} /><span>Green = Done within 3 days</span></div>
                                <div className={styles['legend-row']}><div className={styles['legend-sample']} style={{ background: 'rgb(255, 204, 0)' }} /><span>Yellow = 4-6 days ago</span></div>
                                <div className={styles['legend-row']}><div className={styles['legend-sample']} style={{ background: 'rgb(255, 149, 0)' }} /><span>Orange = 7-10 days ago</span></div>
                                <div className={styles['legend-row']}><div className={styles['legend-sample']} style={{ background: 'rgb(255, 59, 48)' }} /><span>Red = 11+ days or never done</span></div>
                            </div>
                            <div className={styles['legend-section']}>
                                <div className={styles['legend-section-title']}>Bar Opacity = 3-Week Momentum</div>
                                <p className={styles['legend-description']}>Shows if you&apos;re keeping up over time. <strong>Solid = exercising regularly.</strong> <strong>Faded = falling behind.</strong></p>
                                <div className={styles['legend-row']}>
                                    <div className={styles['legend-opacity-samples']}>
                                        <div className={styles['legend-opacity-sample']} style={{ background: '#007AFF', opacity: 1 }} />
                                        <div className={styles['legend-opacity-sample']} style={{ background: '#007AFF', opacity: 0.7 }} />
                                        <div className={styles['legend-opacity-sample']} style={{ background: '#007AFF', opacity: 0.4 }} />
                                        <div className={styles['legend-opacity-sample']} style={{ background: '#007AFF', opacity: 0.15 }} />
                                    </div>
                                    <span>Solid → Faded</span>
                                </div>
                            </div>
                            <div className={styles['legend-section']}>
                                <div className={styles['legend-section-title']}>Exercise Borders</div>
                                <div className={styles['legend-row']}><div className={styles['legend-sample']} style={{ borderLeft: '3px solid var(--danger-color)', background: 'var(--bg-tertiary)' }} /><span>Red = HIGH contribution (priority)</span></div>
                                <div className={styles['legend-row']}><div className={styles['legend-sample']} style={{ borderLeft: '3px solid var(--warning-color)', background: 'var(--bg-tertiary)' }} /><span>Orange = MEDIUM contribution</span></div>
                                <div className={styles['legend-row']}><div className={styles['legend-sample']} style={{ borderLeft: '3px solid var(--accent-color)', background: 'var(--bg-tertiary)' }} /><span>Blue = LOW contribution</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Coverage matrix */}
                    <div className={styles['coverage-section']}>
                        {loading && <div className={styles.loading}>Loading coverage data...</div>}
                        {error && <div className={styles['empty-state']}>Error: {error}</div>}
                        {!loading && coverageResult && (
                            <CoverageMatrix
                                coverageData={coverageResult.coverageData}
                                collapsedRegions={collapsedRegions}
                                onToggleRegion={toggleRegion}
                                expandedCapacities={expandedCapacities}
                                onToggleCapacity={toggleCapacity}
                                colorScoreToRGB={colorScoreToRGB}
                                coverageConstants={COVERAGE_CONSTANTS}
                            />
                        )}
                    </div>
                </>
            )}
        </>
    );
}

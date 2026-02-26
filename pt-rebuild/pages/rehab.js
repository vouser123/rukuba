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
    // Summary card render
    // =========================================================================

    function renderSummary(summary) {
        if (!summary) return null;
        const { lastDoneAgo, coverage7, exercisesDone7, totalExercises, avgOpacity } = summary;

        let lastActivityText = 'No activity';
        let lastActivityColor = 'var(--danger-color)';
        if (lastDoneAgo !== null) {
            lastActivityText = lastDoneAgo === 0 ? 'Today' : `${lastDoneAgo} days ago`;
            lastActivityColor = lastDoneAgo <= 1 ? 'var(--success-color)' :
                                lastDoneAgo <= 3 ? 'var(--warning-color)' : 'var(--danger-color)';
        }

        const weekText = `${coverage7}% (${exercisesDone7}/${totalExercises})`;
        const weekColor = coverage7 >= 70 ? 'var(--success-color)' :
                          coverage7 >= 40 ? 'var(--warning-color)' : 'var(--danger-color)';

        let trendText = `📉 Low (${avgOpacity}%) - needs more sessions`;
        let trendColor = 'var(--danger-color)';
        if (avgOpacity >= 70) { trendText = `📈 Strong (${avgOpacity}%) - exercising consistently`; trendColor = 'var(--success-color)'; }
        else if (avgOpacity >= 50) { trendText = `↗️ Building (${avgOpacity}%) - good momentum`; trendColor = 'var(--success-color)'; }
        else if (avgOpacity >= 30) { trendText = `↘️ Fading (${avgOpacity}%) - activity dropping`; trendColor = 'var(--warning-color)'; }

        return (
            <div className={styles['summary-card']}>
                <h3>Coverage Overview</h3>
                <div className={styles['summary-row']}>
                    <span className={styles['summary-label']}>Last Activity:</span>
                    <span className={styles['summary-value']} style={{ color: lastActivityColor }}>{lastActivityText}</span>
                </div>
                <div className={styles['summary-row']}>
                    <span className={styles['summary-label']}>7-Day Coverage:</span>
                    <span className={styles['summary-value']} style={{ color: weekColor }}>{weekText}</span>
                </div>
                <div className={styles['summary-row']}>
                    <span className={styles['summary-label']}>21-Day Trend:</span>
                    <span className={styles['summary-value']} style={{ color: trendColor }}>{trendText}</span>
                </div>
            </div>
        );
    }

    // =========================================================================
    // Coverage matrix rendering
    // =========================================================================

    function renderMatrix(coverageData) {
        if (!coverageData || Object.keys(coverageData).length === 0) {
            return <div className={styles['empty-state']}>No coverage data available.</div>;
        }

        // Sort regions: worst color score first (most neglected at the top)
        const regions = Object.keys(coverageData).sort((a, b) => {
            const aScore = (coverageData[a]._regionBar || {}).color_score || 0;
            const bScore = (coverageData[b]._regionBar || {}).color_score || 0;
            return aScore - bScore;
        });

        return regions.map(region => {
            const regionBar = coverageData[region]._regionBar || { percent: 0, color_score: 50, opacity: 50 };
            const capacities = Object.keys(coverageData[region]).filter(k => k !== '_regionBar');
            const isCollapsed = collapsedRegions.has(region);
            const regionColor = colorScoreToRGB(regionBar.color_score);
            const regionOpacity = Math.max(20, regionBar.opacity);

            return (
                <div key={region} className={styles['region-group']}>
                    <div
                        className={styles['region-header']}
                        onPointerUp={() => toggleRegion(region)}
                        role="button"
                        aria-expanded={!isCollapsed}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRegion(region); } }}
                    >
                        <span className={styles['region-title']}>{region}</span>
                        <div className={styles['region-bar-container']}>
                            <div className={styles['coverage-bar']}>
                                <div className={styles['coverage-bar-fill']} style={{
                                    width: `${regionBar.percent}%`,
                                    background: regionColor,
                                    opacity: regionOpacity / 100,
                                }} />
                            </div>
                            <span className={styles['region-stats']}>{regionBar.percent}%</span>
                        </div>
                        <span className={`${styles['expand-icon']} ${isCollapsed ? styles.collapsed : ''}`}>▼</span>
                    </div>
                    <div className={`${styles['region-content']} ${isCollapsed ? styles.collapsed : ''}`}>
                        {capacities.map(capacity => renderCapacity(region, capacity, coverageData[region][capacity]))}
                    </div>
                </div>
            );
        });
    }

    function renderCapacity(region, capacity, capData) {
        const exercises = capData.exercises || [];
        const percent = Math.round(capData.percent || 0);
        const colorScore = capData.color_score || 0;
        const opacity = Math.max(20, capData.opacity || 20);
        const color = capData.color || colorScoreToRGB(colorScore);
        const capKey = `${region}-${capacity}`;
        const isExpanded = expandedCapacities.has(capKey);

        const C = COVERAGE_CONSTANTS;
        let recencyText = '!! very overdue';
        if (colorScore >= C.RECENCY_RECENT_MIN)    recencyText = '✓ done recently';
        else if (colorScore >= C.RECENCY_FEW_DAYS_MIN) recencyText = '~ a few days ago';
        else if (colorScore >= C.RECENCY_STALE_MIN)    recencyText = '⚠ getting stale';
        else if (colorScore >= C.RECENCY_OVERDUE_MIN)  recencyText = '! overdue';

        let trendText = `↓↓ low (${opacity}%)`;
        if (opacity >= C.TREND_STEADY_MIN)   trendText = `↑ steady (${opacity}%)`;
        else if (opacity >= C.TREND_OK_MIN)  trendText = `→ ok (${opacity}%)`;
        else if (opacity >= C.TREND_SLIPPING_MIN) trendText = `↓ slipping (${opacity}%)`;

        // Group exercises by focus for rendering
        const focusGroups = new Map();
        focusGroups.set('general', []);
        for (const ex of exercises) {
            const focus = ex.focus || 'general';
            if (!focusGroups.has(focus)) focusGroups.set(focus, []);
            focusGroups.get(focus).push(ex);
        }

        return (
            <div key={capKey} className={`${styles['capacity-group']} ${isExpanded ? styles.expanded : ''}`}>
                <div
                    className={styles['capacity-header']}
                    onPointerUp={() => toggleCapacity(capKey)}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCapacity(capKey); } }}
                >
                    <span className={styles['capacity-title']}>{capacity}</span>
                    <div className={styles['capacity-bar-container']}>
                        <div className={styles['coverage-bar']}>
                            <div className={styles['coverage-bar-fill']} style={{
                                width: `${percent}%`,
                                background: color,
                                opacity: opacity / 100,
                            }} />
                        </div>
                        <span className={styles['capacity-stats']}>{percent}%</span>
                    </div>
                    <span className={styles['capacity-chevron']}>›</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0 4px 0', marginLeft: '2px' }}>
                    This week: {percent}% • Last done: {recencyText} • 3-week: {trendText}
                </div>
                <div className={styles['focus-list']}>
                    {Array.from(focusGroups.entries()).map(([focus, focusExercises]) => {
                        if (focusExercises.length === 0) return null;
                        return renderFocusGroup(focus, focusExercises);
                    })}
                </div>
            </div>
        );
    }

    function renderFocusGroup(focus, exercises) {
        const doneCount = exercises.filter(e => e.lastDone).length;
        const totalCount = exercises.length;
        let statusClass = '';
        if (doneCount === 0) statusClass = 'not-covered';
        else if (doneCount < totalCount) statusClass = 'needs-attention';

        return (
            <div key={focus} className={[styles['focus-item'], statusClass ? styles[statusClass] : ''].filter(Boolean).join(' ')}>
                <div className={styles['focus-header']}>
                    <span className={styles['focus-name']}>
                        {focus === 'general' ? 'General' : focus.replace(/_/g, ' ')}
                    </span>
                    <span className={styles['focus-stats']}>{doneCount}/{totalCount}</span>
                </div>
                <div className={styles['exercise-list']}>
                    {exercises.map(ex => renderExerciseCard(ex))}
                </div>
            </div>
        );
    }

    function renderExerciseCard(ex) {
        const isDone = !!ex.lastDone;
        const daysSince = ex.daysSince || 0;
        const isOverdue = !isDone || daysSince >= 7;
        const statusIcon = isOverdue ? '⚠' : '✓';
        const statusColor = isOverdue ? 'var(--warning-color)' : 'var(--success-color)';
        const statusText = isDone ? `${daysSince}d ago` : 'never';
        const contribution = ex.contribution || 'low';
        const contribColor = contribution === 'high' ? 'var(--danger-color)' :
                             contribution === 'medium' ? 'var(--warning-color)' : 'var(--accent-color)';

        return (
            <div key={ex.id} className={`${styles['exercise-card']} ${styles[`contrib-${contribution}`]}`}>
                <span className={styles['exercise-card-icon']} style={{ color: statusColor }}>{statusIcon}</span>
                <div className={styles['exercise-card-content']}>
                    <div className={styles['exercise-card-title']}>{ex.name}</div>
                    <div className={styles['exercise-card-meta']}>
                        <span style={{ color: contribColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                            {contribution}
                        </span>
                        <span style={{ margin: '0 6px', opacity: 0.5 }}>•</span>
                        <span style={{ color: statusColor }}>{statusText}</span>
                        <span style={{ margin: '0 6px', opacity: 0.5 }}>•</span>
                        <span style={{ opacity: 0.7 }}>7d: {ex.days7} · 21d: {ex.days21}</span>
                    </div>
                </div>
            </div>
        );
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
                    {coverageResult && renderSummary(coverageResult.summary)}

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
                        {!loading && coverageResult && renderMatrix(coverageResult.coverageData)}
                    </div>
                </>
            )}
        </>
    );
}

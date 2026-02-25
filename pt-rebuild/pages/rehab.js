/**
 * Rehab Coverage Analysis — Next.js page (DN-033).
 * Replaces public/rehab_coverage.html.
 * public/rehab_coverage.html stays live until this is verified in production.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { createClient } from '@supabase/supabase-js';
import { buildCoverageData, colorScoreToRGB, COVERAGE_CONSTANTS } from '../lib/rehab-coverage';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function RehabCoverage() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Auth form
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    // Coverage data returned by buildCoverageData
    const [coverageResult, setCoverageResult] = useState(null); // { coverageData, summary }

    // UI interaction state
    const [collapsedRegions, setCollapsedRegions] = useState(new Set());
    const [expandedCapacities, setExpandedCapacities] = useState(new Set());
    const [legendExpanded, setLegendExpanded] = useState(false);

    // Track whether HamburgerMenu script is loaded — init is deferred until both script + data are ready
    const hamburgerReady = useRef(false);
    const sessionRef = useRef(null);
    const userRoleRef = useRef(null);

    // =========================================================================
    // Data loading
    // =========================================================================

    /** Fetch logs + roles in parallel, compute coverage data, init hamburger menu */
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

            const logs = logsData.logs || [];
            const roles = rolesData.roles || [];
            userRoleRef.current = rolesData.user_role || 'patient';

            const result = buildCoverageData(logs, roles);
            setCoverageResult(result);
            setLoading(false);

            // Init hamburger menu now that role and data are resolved
            if (hamburgerReady.current && sessionRef.current) {
                initHamburger(sessionRef.current, userRoleRef.current, accessToken);
            }
        } catch (err) {
            console.error('loadData failed:', err);
            setError(err.message || 'Failed to load coverage data.');
            setLoading(false);
        }
    }, []);

    /** Initialize shared HamburgerMenu. Called after both data load and script load. */
    function initHamburger(sess, role, accessToken) {
        if (!window.HamburgerMenu) return;
        window.HamburgerMenu.init({
            currentUser: sess.user,
            signOutFn: () => supabase.auth.signOut(),
            page: 'rehab_coverage',
            isAdmin: role !== 'patient',
            menuItems: [
                { action: 'refresh-data', icon: '🔄', label: 'Refresh Data' },
            ],
            onAction: (action) => {
                if (action === 'refresh-data') {
                    window.HamburgerMenu.close();
                    loadData(accessToken);
                    return true;
                }
                return false;
            },
        });
    }

    // =========================================================================
    // Auth
    // =========================================================================

    useEffect(() => {
        // Check existing session on mount
        supabase.auth.getSession().then(({ data: { session: sess } }) => {
            setSession(sess);
            sessionRef.current = sess;
            if (sess) {
                loadData(sess.access_token);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
            setSession(sess);
            sessionRef.current = sess;
            if (event === 'SIGNED_IN' && sess) {
                loadData(sess.access_token);
            }
            if (event === 'SIGNED_OUT') {
                setCoverageResult(null);
                userRoleRef.current = null;
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [loadData]);

    /** Handle sign-in form submission */
    async function handleSignIn(e) {
        e.preventDefault();
        setAuthError('');
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) setAuthError(signInError.message);
    }

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
    // Summary helpers
    // =========================================================================

    function renderSummary(summary) {
        if (!summary) return null;
        const { lastDoneAgo, coverage7, exercisesDone7, totalExercises, avgOpacity } = summary;

        // Last activity
        let lastActivityText = 'No activity';
        let lastActivityColor = 'var(--danger-color)';
        if (lastDoneAgo !== null) {
            lastActivityText = lastDoneAgo === 0 ? 'Today' : `${lastDoneAgo} days ago`;
            lastActivityColor = lastDoneAgo <= 1 ? 'var(--success-color)' :
                                lastDoneAgo <= 3 ? 'var(--warning-color)' : 'var(--danger-color)';
        }

        // 7-day coverage
        const weekText = `${coverage7}% (${exercisesDone7}/${totalExercises})`;
        const weekColor = coverage7 >= 70 ? 'var(--success-color)' :
                          coverage7 >= 40 ? 'var(--warning-color)' : 'var(--danger-color)';

        // 21-day trend
        let trendText = `📉 Low (${avgOpacity}%) - needs more sessions`;
        let trendColor = 'var(--danger-color)';
        if (avgOpacity >= 70) { trendText = `📈 Strong (${avgOpacity}%) - exercising consistently`; trendColor = 'var(--success-color)'; }
        else if (avgOpacity >= 50) { trendText = `↗️ Building (${avgOpacity}%) - good momentum`; trendColor = 'var(--success-color)'; }
        else if (avgOpacity >= 30) { trendText = `↘️ Fading (${avgOpacity}%) - activity dropping`; trendColor = 'var(--warning-color)'; }

        return (
            <div className="summary-card">
                <h3>Coverage Overview</h3>
                <div className="summary-row">
                    <span className="summary-label">Last Activity:</span>
                    <span className="summary-value" style={{ color: lastActivityColor }}>{lastActivityText}</span>
                </div>
                <div className="summary-row">
                    <span className="summary-label">7-Day Coverage:</span>
                    <span className="summary-value" style={{ color: weekColor }}>{weekText}</span>
                </div>
                <div className="summary-row">
                    <span className="summary-label">21-Day Trend:</span>
                    <span className="summary-value" style={{ color: trendColor }}>{trendText}</span>
                </div>
            </div>
        );
    }

    // =========================================================================
    // Coverage matrix rendering
    // =========================================================================

    function renderMatrix(coverageData) {
        if (!coverageData || Object.keys(coverageData).length === 0) {
            return <div className="empty-state">No coverage data available.</div>;
        }

        // Sort regions: worst color score first
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
                <div key={region} className="region-group">
                    <div
                        className="region-header"
                        onPointerUp={() => toggleRegion(region)}
                        role="button"
                        aria-expanded={!isCollapsed}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRegion(region); } }}
                    >
                        <span className="region-title">{region}</span>
                        <div className="region-bar-container">
                            <div className="coverage-bar">
                                <div className="coverage-bar-fill" style={{
                                    width: `${regionBar.percent}%`,
                                    background: regionColor,
                                    opacity: regionOpacity / 100,
                                }} />
                            </div>
                            <span className="region-stats">{regionBar.percent}%</span>
                        </div>
                        <span className={`expand-icon ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
                    </div>
                    <div className={`region-content ${isCollapsed ? 'collapsed' : ''}`}>
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

        // Build recency + trend text for subtitle
        const C = COVERAGE_CONSTANTS;
        let recencyText = '!! very overdue';
        if (colorScore >= C.RECENCY_RECENT_MIN) recencyText = '✓ done recently';
        else if (colorScore >= C.RECENCY_FEW_DAYS_MIN) recencyText = '~ a few days ago';
        else if (colorScore >= C.RECENCY_STALE_MIN) recencyText = '⚠ getting stale';
        else if (colorScore >= C.RECENCY_OVERDUE_MIN) recencyText = '! overdue';

        let trendText = `↓↓ low (${opacity}%)`;
        if (opacity >= C.TREND_STEADY_MIN) trendText = `↑ steady (${opacity}%)`;
        else if (opacity >= C.TREND_OK_MIN) trendText = `→ ok (${opacity}%)`;
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
            <div key={capKey} className={`capacity-group ${isExpanded ? 'expanded' : ''}`}>
                <div
                    className="capacity-header"
                    onPointerUp={() => toggleCapacity(capKey)}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCapacity(capKey); } }}
                >
                    <span className="capacity-title">{capacity}</span>
                    <div className="capacity-bar-container">
                        <div className="coverage-bar">
                            <div className="coverage-bar-fill" style={{
                                width: `${percent}%`,
                                background: color,
                                opacity: opacity / 100,
                            }} />
                        </div>
                        <span className="capacity-stats">{percent}%</span>
                    </div>
                    <span className="capacity-chevron">›</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0 4px 0', marginLeft: '2px' }}>
                    This week: {percent}% • Last done: {recencyText} • 3-week: {trendText}
                </div>
                <div className="focus-list">
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
            <div key={focus} className={`focus-item ${statusClass}`}>
                <div className="focus-header">
                    <span className="focus-name">
                        {focus === 'general' ? 'General' : focus.replace(/_/g, ' ')}
                    </span>
                    <span className="focus-stats">{doneCount}/{totalCount}</span>
                </div>
                <div className="exercise-list">
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
            <div key={ex.id} className={`exercise-card contrib-${contribution}`}>
                <span className="exercise-card-icon" style={{ color: statusColor }}>{statusIcon}</span>
                <div className="exercise-card-content">
                    <div className="exercise-card-title">{ex.name}</div>
                    <div className="exercise-card-meta">
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
                <link rel="stylesheet" href="/css/main.css" />
                <link rel="stylesheet" href="/css/rehab-coverage.css" />
            </Head>

            {/* Auth modal — shown when not signed in */}
            {!session && (
                <div className="auth-modal">
                    <div className="auth-content">
                        <h2>Coverage Analysis Sign In</h2>
                        <form onSubmit={handleSignIn} className="auth-form">
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="Email"
                                required
                                autoComplete="email"
                            />
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                                autoComplete="current-password"
                            />
                            <button type="submit">Sign In</button>
                            {authError && <div className="auth-error">{authError}</div>}
                        </form>
                    </div>
                </div>
            )}

            {/* Main app — shown when signed in */}
            {session && (
                <>
                    {/* Header — data-action="toggle-hamburger" is handled by HamburgerMenu */}
                    <div className="header">
                        <h1>Rehab Coverage</h1>
                        <div className="header-actions">
                            <button
                                className="btn btn-secondary"
                                data-action="refresh-data"
                                onPointerUp={() => loadData(session.access_token)}
                            >
                                ↻
                            </button>
                            <button className="hamburger-btn" data-action="toggle-hamburger">☰</button>
                        </div>
                    </div>

                    {/* Summary card */}
                    {coverageResult && renderSummary(coverageResult.summary)}

                    {/* Legend */}
                    <div className={`legend-card ${legendExpanded ? 'expanded' : ''}`}>
                        <div
                            className="legend-header"
                            onPointerUp={() => setLegendExpanded(p => !p)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLegendExpanded(p => !p); } }}
                        >
                            <h4>📊 How to Read Coverage Bars</h4>
                            <span className="legend-toggle">›</span>
                        </div>
                        <div className="legend-content">
                            <div className="legend-section">
                                <div className="legend-section-title">Bar Width = 7-Day Density</div>
                                <p className="legend-description">How consistently exercises are being done in the past week.</p>
                                <div className="legend-row"><div className="legend-sample" style={{ width: '40px', background: '#888' }} /><span>100% = All exercises done daily</span></div>
                                <div className="legend-row"><div className="legend-sample" style={{ width: '20px', background: '#888' }} /><span>50% = About half the expected volume</span></div>
                                <div className="legend-row"><div className="legend-sample" style={{ width: '4px', background: '#888' }} /><span>0% = No exercises done this week</span></div>
                            </div>
                            <div className="legend-section">
                                <div className="legend-section-title">Bar Color = Recency</div>
                                <p className="legend-description">How recently the most neglected exercise was done.</p>
                                <div className="legend-row"><div className="legend-sample" style={{ background: 'rgb(52, 199, 89)' }} /><span>Green = Done within 3 days</span></div>
                                <div className="legend-row"><div className="legend-sample" style={{ background: 'rgb(255, 204, 0)' }} /><span>Yellow = 4-6 days ago</span></div>
                                <div className="legend-row"><div className="legend-sample" style={{ background: 'rgb(255, 149, 0)' }} /><span>Orange = 7-10 days ago</span></div>
                                <div className="legend-row"><div className="legend-sample" style={{ background: 'rgb(255, 59, 48)' }} /><span>Red = 11+ days or never done</span></div>
                            </div>
                            <div className="legend-section">
                                <div className="legend-section-title">Bar Opacity = 3-Week Momentum</div>
                                <p className="legend-description">Shows if you're keeping up over time. <strong>Solid = exercising regularly.</strong> <strong>Faded = falling behind.</strong></p>
                                <div className="legend-row">
                                    <div className="legend-opacity-samples">
                                        <div className="legend-opacity-sample" style={{ background: '#007AFF', opacity: 1 }} />
                                        <div className="legend-opacity-sample" style={{ background: '#007AFF', opacity: 0.7 }} />
                                        <div className="legend-opacity-sample" style={{ background: '#007AFF', opacity: 0.4 }} />
                                        <div className="legend-opacity-sample" style={{ background: '#007AFF', opacity: 0.15 }} />
                                    </div>
                                    <span>Solid → Faded</span>
                                </div>
                            </div>
                            <div className="legend-section">
                                <div className="legend-section-title">Exercise Borders</div>
                                <div className="legend-row"><div className="legend-sample" style={{ borderLeft: '3px solid var(--danger-color)', background: 'var(--bg-tertiary)' }} /><span>Red = HIGH contribution (priority)</span></div>
                                <div className="legend-row"><div className="legend-sample" style={{ borderLeft: '3px solid var(--warning-color)', background: 'var(--bg-tertiary)' }} /><span>Orange = MEDIUM contribution</span></div>
                                <div className="legend-row"><div className="legend-sample" style={{ borderLeft: '3px solid var(--accent-color)', background: 'var(--bg-tertiary)' }} /><span>Blue = LOW contribution</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Coverage matrix */}
                    <div className="coverage-section">
                        {loading && <div className="loading">Loading coverage data...</div>}
                        {error && <div className="empty-state">Error: {error}</div>}
                        {!loading && coverageResult && renderMatrix(coverageResult.coverageData)}
                    </div>
                </>
            )}

            {/* HamburgerMenu — existing shared module, loaded after page is interactive */}
            <Script
                src="/js/vendor/supabase.min.js"
                strategy="beforeInteractive"
            />
            <Script
                src="/js/hamburger-menu.js"
                strategy="afterInteractive"
                onLoad={() => {
                    hamburgerReady.current = true;
                    // If data and session already loaded before script was ready, init now
                    if (sessionRef.current && userRoleRef.current) {
                        initHamburger(sessionRef.current, userRoleRef.current, sessionRef.current.access_token);
                    }
                }}
            />
            <Script id="sw-register" strategy="afterInteractive">{`
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.register('/sw.js');
                    let refreshing = false;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (!refreshing) { refreshing = true; window.location.reload(); }
                    });
                }
            `}</Script>
        </>
    );
}

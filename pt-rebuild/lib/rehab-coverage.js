/**
 * Rehab Coverage — pure calculation functions and data builder.
 * Extracted from public/rehab_coverage.html (DN-033).
 *
 * All functions here are pure: no DOM access, no fetch, no side effects.
 * Import these in pages/rehab.js (and any future pages that need coverage data).
 *
 * SPECIFICATION: rehab_coverage formulas.md (LOCKED)
 * To adjust thresholds or weights, edit COVERAGE_CONSTANTS only.
 */

// ============================================================================
// CONSTANTS - Edit these to adjust formula behavior
// ============================================================================
export const COVERAGE_CONSTANTS = {
    // Contribution weights
    HIGH_WEIGHT: 1.0,
    MEDIUM_WEIGHT: 0.4,
    MEDIUM_BONUS_CAP: 15,        // Max percentage bonus from MEDIUM exercises

    // Opacity (21-day trend) settings
    OPACITY_WINDOW_DAYS: 21,
    OPACITY_OPTIMAL_DAYS: 15,    // Days of activity for 100% opacity

    // Decay thresholds (days since last activity)
    DECAY_NONE_MAX: 6,           // No decay if <= 6 days
    DECAY_SLIGHT_MAX: 9,         // Slight decay (0.8x) if 7-9 days
    DECAY_MODERATE_MAX: 13,      // Moderate decay (0.5x) if 10-13 days
    // Heavy decay (0.3x) if >= 14 days

    // Recovery thresholds (7-day activity count)
    RECOVERY_STRONG_MIN: 5,      // 90% floor
    RECOVERY_GOOD_MIN: 4,        // 70% floor
    RECOVERY_NOTICEABLE_MIN: 3,  // 50% floor

    // Focus aggregation weights
    FOCUS_WORST_WEIGHT: 0.6,
    FOCUS_OTHERS_WEIGHT: 0.4,

    // Region bar weight exponent
    REGION_WEIGHT_EXPONENT: 1.3,

    // Color score (recency) - days since last done -> score
    // Higher score = greener (more recent)
    COLOR_SCORE_DAY_0: 100,      // Done today
    COLOR_SCORE_DAY_1: 85,       // Done yesterday
    COLOR_SCORE_DAY_2: 60,       // 2 days ago
    COLOR_SCORE_DAY_3: 35,       // 3 days ago
    COLOR_SCORE_DAY_4: 15,       // 4 days ago
    COLOR_SCORE_DECAY: 2,        // Points lost per day after day 4

    // Recency text thresholds (based on color score)
    RECENCY_RECENT_MIN: 80,      // "✓ done recently"
    RECENCY_FEW_DAYS_MIN: 60,    // "~ a few days ago"
    RECENCY_STALE_MIN: 40,       // "⚠ getting stale"
    RECENCY_OVERDUE_MIN: 20,     // "! overdue"
    // Below 20 = "!! very overdue"

    // Trend text thresholds (based on opacity %)
    TREND_STEADY_MIN: 70,        // "↑ steady"
    TREND_OK_MIN: 50,            // "→ ok"
    TREND_SLIPPING_MIN: 30,      // "↓ slipping"
    // Below 30 = "↓↓ low"
};

// ============================================================================
// BASE HELPERS
// ============================================================================

/** @returns {Map<focus, exercise[]>} exercises grouped by focus field */
export function groupExercisesByFocus(exercises) {
    const groups = new Map();
    for (const ex of exercises) {
        const focus = ex.focus || 'general';
        if (!groups.has(focus)) {
            groups.set(focus, []);
        }
        groups.get(focus).push(ex);
    }
    return groups;
}

/** @returns {number} arithmetic mean of array, 0 if empty */
export function average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** @returns {number} weighted mean, 0 if total weight is 0 */
export function weightedAverage(values, weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return 0;
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
        sum += values[i] * weights[i];
    }
    return sum / totalWeight;
}

/**
 * Days between two dates (ignoring time-of-day).
 * @returns {number} integer days, positive if date2 is later
 */
export function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// INTERNAL HELPERS (not exported — used by the three main signal functions)
// ============================================================================

/**
 * Convert days-since-last to a 0-100 color score.
 * Higher score = greener (more recent). Thresholds in COVERAGE_CONSTANTS.
 */
function daysToColorScore(days) {
    const C = COVERAGE_CONSTANTS;
    if (days === 0) return C.COLOR_SCORE_DAY_0;
    if (days === 1) return C.COLOR_SCORE_DAY_1;
    if (days === 2) return C.COLOR_SCORE_DAY_2;
    if (days === 3) return C.COLOR_SCORE_DAY_3;
    if (days === 4) return C.COLOR_SCORE_DAY_4;
    return Math.max(0, C.COLOR_SCORE_DAY_4 - (days - 4) * C.COLOR_SCORE_DECAY);
}

function calculatePercentForMediumAsHigh(medium_exercises, history_7_days) {
    if (medium_exercises.length === 0) return 0;
    let contribution = 0;
    for (const ex of medium_exercises) {
        const days = history_7_days.get(ex.id) || 0;
        contribution += (days / 7.0);
    }
    const coverage = contribution / medium_exercises.length;
    return Math.min(coverage * 100, 50); // Cap at 50% for MEDIUM-only
}

function calculatePercentWithFocuses(high_exercises, medium_exercises, history_7_days, focuses) {
    const focusGroups = groupExercisesByFocus(high_exercises);
    const focusPercents = [];
    for (const [, exercises] of focusGroups) {
        let contribution = 0;
        for (const ex of exercises) {
            const days = history_7_days.get(ex.id) || 0;
            contribution += (days / 7.0);
        }
        focusPercents.push((contribution / exercises.length) * 100);
    }
    const worst = Math.min(...focusPercents);
    const others = focusPercents.filter(p => p !== worst);
    const avgOthers = others.length > 0 ? average(others) : worst;
    const base = COVERAGE_CONSTANTS.FOCUS_WORST_WEIGHT * worst +
                 COVERAGE_CONSTANTS.FOCUS_OTHERS_WEIGHT * avgOthers;
    let mediumContribution = 0;
    for (const ex of medium_exercises) {
        const days = history_7_days.get(ex.id) || 0;
        mediumContribution += (days / 7.0) * COVERAGE_CONSTANTS.MEDIUM_WEIGHT;
    }
    const mediumBonus = Math.min(
        (mediumContribution / high_exercises.length) * 100,
        COVERAGE_CONSTANTS.MEDIUM_BONUS_CAP
    );
    return Math.min(base + mediumBonus, 100);
}

function calculateColorForMedium(medium_exercises, last_done_dates, current_date) {
    if (medium_exercises.length === 0) return 0;
    let maxDaysSince = 0;
    for (const ex of medium_exercises) {
        const lastDone = last_done_dates.get(ex.id);
        if (!lastDone) return 0;
        const daysSince = daysBetween(lastDone, current_date);
        maxDaysSince = Math.max(maxDaysSince, daysSince);
    }
    return daysToColorScore(maxDaysSince);
}

function calculateColorWithFocuses(high_exercises, last_done_dates, current_date, focuses) {
    const focusGroups = groupExercisesByFocus(high_exercises);
    const focusScores = [];
    for (const [, exercises] of focusGroups) {
        let maxDays = 0;
        let hasNeverDone = false;
        for (const ex of exercises) {
            const lastDone = last_done_dates.get(ex.id);
            if (!lastDone) { hasNeverDone = true; break; }
            const daysSince = daysBetween(lastDone, current_date);
            maxDays = Math.max(maxDays, daysSince);
        }
        focusScores.push(hasNeverDone ? 0 : daysToColorScore(maxDays));
    }
    const worst = Math.min(...focusScores);
    const others = focusScores.filter(s => s !== worst);
    const avgOthers = others.length > 0 ? average(others) : worst;
    return COVERAGE_CONSTANTS.FOCUS_WORST_WEIGHT * worst +
           COVERAGE_CONSTANTS.FOCUS_OTHERS_WEIGHT * avgOthers;
}

function calculateOpacityForMedium(medium_exercises, history_21_days, history_7_days, last_done_dates, current_date) {
    if (medium_exercises.length === 0) return 20;
    let total21 = 0, totalRecent = 0, minDaysSince = Infinity;
    for (const ex of medium_exercises) {
        total21 += history_21_days.get(ex.id) || 0;
        totalRecent += history_7_days.get(ex.id) || 0;
        const lastDone = last_done_dates.get(ex.id);
        if (lastDone) {
            const daysSince = daysBetween(lastDone, current_date);
            minDaysSince = Math.min(minDaysSince, daysSince);
        }
    }
    const avg21 = total21 / medium_exercises.length;
    const avgRecent = totalRecent / medium_exercises.length;
    let base = Math.min(avg21 / COVERAGE_CONSTANTS.OPACITY_OPTIMAL_DAYS, 1.0) * 100;
    if (minDaysSince >= 14) base *= 0.3;
    else if (minDaysSince >= 10) base *= 0.5;
    else if (minDaysSince >= 7) base *= 0.8;
    if (avgRecent >= 5) base = Math.max(base, 70);
    else if (avgRecent >= 4) base = Math.max(base, 50);
    else if (avgRecent >= 3) base = Math.max(base, 35);
    return Math.round(base);
}

function calculateOpacityWithFocuses(high_exercises, history_21_days, history_7_days, last_done_dates, current_date, focuses) {
    const focusGroups = groupExercisesByFocus(high_exercises);
    const focusOpacities = [];
    for (const [, exercises] of focusGroups) {
        let total21 = 0, totalRecent = 0, minDaysSince = Infinity;
        for (const ex of exercises) {
            total21 += history_21_days.get(ex.id) || 0;
            totalRecent += history_7_days.get(ex.id) || 0;
            const lastDone = last_done_dates.get(ex.id);
            if (lastDone) {
                const daysSince = daysBetween(lastDone, current_date);
                minDaysSince = Math.min(minDaysSince, daysSince);
            }
        }
        const avg21 = total21 / exercises.length;
        const avgRecent = totalRecent / exercises.length;
        let base = Math.min(avg21 / COVERAGE_CONSTANTS.OPACITY_OPTIMAL_DAYS, 1.0) * 100;
        if (minDaysSince >= 14) base *= 0.3;
        else if (minDaysSince >= 10) base *= 0.5;
        else if (minDaysSince >= 7) base *= 0.8;
        if (avgRecent >= 5) base = Math.max(base, 90);
        else if (avgRecent >= 4) base = Math.max(base, 70);
        else if (avgRecent >= 3) base = Math.max(base, 50);
        focusOpacities.push(base);
    }
    const worst = Math.min(...focusOpacities);
    const others = focusOpacities.filter(o => o !== worst);
    const avgOthers = others.length > 0 ? average(others) : worst;
    return Math.round(
        COVERAGE_CONSTANTS.FOCUS_WORST_WEIGHT * worst +
        COVERAGE_CONSTANTS.FOCUS_OTHERS_WEIGHT * avgOthers
    );
}

// ============================================================================
// FORMULA 1: PERCENT (7-Day Density)
// ============================================================================
/**
 * Calculate the 7-day density percentage for a capacity bar.
 * @param {Object} capacityBarData
 * @returns {number} 0-100
 */
export function calculatePercent(capacityBarData) {
    const { high_exercises, medium_exercises, history_7_days, focuses } = capacityBarData;
    if (high_exercises.length === 0) {
        return calculatePercentForMediumAsHigh(medium_exercises, history_7_days);
    }
    if (focuses && focuses.length > 1) {
        return calculatePercentWithFocuses(high_exercises, medium_exercises, history_7_days, focuses);
    }
    let highContribution = 0;
    for (const ex of high_exercises) {
        const days = history_7_days.get(ex.id) || 0;
        highContribution += (days / 7.0);
    }
    let mediumContribution = 0;
    for (const ex of medium_exercises) {
        const days = history_7_days.get(ex.id) || 0;
        mediumContribution += (days / 7.0) * COVERAGE_CONSTANTS.MEDIUM_WEIGHT;
    }
    const coverage = highContribution / high_exercises.length;
    const mediumBonus = Math.min(
        (mediumContribution / high_exercises.length) * 100,
        COVERAGE_CONSTANTS.MEDIUM_BONUS_CAP
    );
    return Math.min(coverage * 100 + mediumBonus, 100);
}

// ============================================================================
// FORMULA 2: COLOR SCORE (Recency)
// ============================================================================
/**
 * Calculate the color score (0-100) based on recency of most neglected exercise.
 * @param {Object} capacityBarData
 * @returns {number} 0-100
 */
export function calculateColorScore(capacityBarData) {
    const { high_exercises, medium_exercises, low_exercises, last_done_dates, current_date, focuses } = capacityBarData;
    let targetExercises;
    if (high_exercises.length > 0) {
        targetExercises = high_exercises;
    } else if (medium_exercises.length > 0) {
        targetExercises = medium_exercises;
    } else if (low_exercises && low_exercises.length > 0) {
        targetExercises = low_exercises;
    } else {
        return 0;
    }
    if (targetExercises === high_exercises && focuses && focuses.length > 1) {
        return calculateColorWithFocuses(high_exercises, last_done_dates, current_date, focuses);
    }
    let maxDaysSince = 0;
    for (const ex of targetExercises) {
        const lastDone = last_done_dates.get(ex.id);
        if (!lastDone) return 0;
        const daysSince = daysBetween(lastDone, current_date);
        maxDaysSince = Math.max(maxDaysSince, daysSince);
    }
    return daysToColorScore(maxDaysSince);
}

// ============================================================================
// FORMULA 3: OPACITY (21-Day Trend)
// ============================================================================
/**
 * Calculate the opacity (0-100) based on 21-day trend with slow decay, fast recovery.
 * @param {Object} capacityBarData
 * @returns {number} 0-100
 */
export function calculateOpacity(capacityBarData) {
    const { high_exercises, medium_exercises, history_21_days, history_7_days, last_done_dates, current_date, focuses } = capacityBarData;
    if (high_exercises.length === 0) {
        return calculateOpacityForMedium(medium_exercises, history_21_days, history_7_days, last_done_dates, current_date);
    }
    if (focuses && focuses.length > 1) {
        return calculateOpacityWithFocuses(high_exercises, history_21_days, history_7_days, last_done_dates, current_date, focuses);
    }
    let total21day = 0;
    for (const ex of high_exercises) {
        total21day += history_21_days.get(ex.id) || 0;
    }
    const avg21day = total21day / high_exercises.length;
    let totalRecent = 0;
    for (const ex of high_exercises) {
        totalRecent += history_7_days.get(ex.id) || 0;
    }
    const avgRecent = totalRecent / high_exercises.length;
    let minDaysSince = Infinity;
    for (const ex of high_exercises) {
        const lastDone = last_done_dates.get(ex.id);
        if (lastDone) {
            const daysSince = daysBetween(lastDone, current_date);
            minDaysSince = Math.min(minDaysSince, daysSince);
        }
    }
    let base = Math.min(avg21day / COVERAGE_CONSTANTS.OPACITY_OPTIMAL_DAYS, 1.0) * 100;
    if (minDaysSince >= 14) {
        base *= 0.3;
    } else if (minDaysSince >= 10) {
        base *= 0.5;
    } else if (minDaysSince >= 7) {
        base *= 0.8;
    }
    if (avgRecent >= COVERAGE_CONSTANTS.RECOVERY_STRONG_MIN) return Math.max(base, 90);
    else if (avgRecent >= COVERAGE_CONSTANTS.RECOVERY_GOOD_MIN) return Math.max(base, 70);
    else if (avgRecent >= COVERAGE_CONSTANTS.RECOVERY_NOTICEABLE_MIN) return Math.max(base, 50);
    return Math.round(base);
}

// ============================================================================
// COLOR SCORE TO RGB
// ============================================================================
/**
 * Convert a 0-100 color score to an RGB color string.
 * 100 = bright green, 50 = yellow, 0 = deep red.
 * @param {number} score
 * @returns {string} e.g. "rgb(132, 204, 129)"
 */
export function colorScoreToRGB(score) {
    if (score >= 85) {
        const t = (score - 85) / 15;
        return `rgb(${Math.round(132 - t * 116)}, ${Math.round(204 + t * 41)}, 129)`;
    } else if (score >= 60) {
        const t = (score - 60) / 25;
        return `rgb(${Math.round(250 - t * 118)}, 204, ${Math.round(21 + t * 108)})`;
    } else if (score >= 35) {
        const t = (score - 35) / 25;
        return `rgb(249, ${Math.round(115 + t * 89)}, 22)`;
    } else if (score >= 15) {
        const t = (score - 15) / 20;
        return `rgb(${Math.round(239 + t * 10)}, ${Math.round(68 + t * 47)}, 22)`;
    } else {
        const t = score / 15;
        return `rgb(${Math.round(185 + t * 54)}, ${Math.round(28 + t * 40)}, ${Math.round(28 - t * 6)})`;
    }
}

// ============================================================================
// REGION BAR AGGREGATION
// ============================================================================
/**
 * Aggregate capacity bars into a region bar using weighted average.
 * Weight = (count of HIGH exercises) ^ REGION_WEIGHT_EXPONENT.
 * @param {Array} capacityBars
 * @returns {{ percent, color_score, opacity }}
 */
export function calculateRegionBar(capacityBars) {
    const weights = capacityBars.map(cap => {
        const highCount = cap.exercises.filter(e => e.contribution === 'high').length;
        return Math.pow(highCount, COVERAGE_CONSTANTS.REGION_WEIGHT_EXPONENT);
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) {
        return { percent: 0, color_score: 0, opacity: 20 };
    }
    return {
        percent: Math.round(weightedAverage(capacityBars.map(c => c.percent), weights)),
        color_score: Math.round(weightedAverage(capacityBars.map(c => c.color_score), weights)),
        opacity: Math.round(weightedAverage(capacityBars.map(c => c.opacity), weights)),
    };
}

// ============================================================================
// DATA BUILDER — converts raw API responses to coverage data structure
// ============================================================================
/**
 * Build the full coverage data structure from raw API responses.
 * Pure function — no DOM, no fetch, no side effects.
 *
 * @param {Array} logs - from /api/logs
 * @param {Array} roles - from /api/roles (includes exercises via join)
 * @returns {{ coverageData, currentDate, summary }}
 */
export function buildCoverageData(logs, roles) {
    const currentDate = new Date();
    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const twentyOneDaysAgo = new Date(currentDate);
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);

    // Build exercise history maps
    const history7Days = new Map();   // exerciseId -> unique days active in last 7
    const history21Days = new Map();  // exerciseId -> unique days active in last 21
    const lastDoneDates = new Map();  // exerciseId -> most recent date

    for (const log of logs) {
        const logDate = new Date(log.performed_at);
        const exerciseId = log.exercise_id;
        if (!exerciseId) continue;

        // Track most recent date
        const existingDate = lastDoneDates.get(exerciseId);
        if (!existingDate || logDate > existingDate) {
            lastDoneDates.set(exerciseId, logDate);
        }

        // Count unique days in 7-day window
        if (logDate >= sevenDaysAgo) {
            const dateKey = logDate.toISOString().split('T')[0];
            const key7 = `${exerciseId}_7_${dateKey}`;
            if (!history7Days.has(key7)) {
                history7Days.set(exerciseId, (history7Days.get(exerciseId) || 0) + 1);
                history7Days.set(key7, true);
            }
        }

        // Count unique days in 21-day window
        if (logDate >= twentyOneDaysAgo) {
            const dateKey = logDate.toISOString().split('T')[0];
            const key21 = `${exerciseId}_21_${dateKey}`;
            if (!history21Days.has(key21)) {
                history21Days.set(exerciseId, (history21Days.get(exerciseId) || 0) + 1);
                history21Days.set(key21, true);
            }
        }
    }

    // Build coverage matrix: region → capacity → data
    const coverageData = {};
    for (const role of roles) {
        const region = role.region || 'uncategorized';
        const capacity = role.capacity || 'general';
        const focus = role.focus || null;
        const contribution = role.contribution || 'low';
        const exerciseId = role.exercise_id;
        const exerciseName = role.exercises?.canonical_name || exerciseId;

        if (!coverageData[region]) coverageData[region] = {};
        if (!coverageData[region][capacity]) {
            coverageData[region][capacity] = { exercises: [], focuses: new Set() };
        }

        const lastDoneDate = lastDoneDates.get(exerciseId) || null;
        coverageData[region][capacity].exercises.push({
            id: exerciseId,
            name: exerciseName,
            contribution,
            focus,
            lastDone: lastDoneDate,
            daysSince: lastDoneDate ? daysBetween(lastDoneDate, currentDate) : null,
            days7: history7Days.get(exerciseId) || 0,
            days21: history21Days.get(exerciseId) || 0,
        });
        if (focus) coverageData[region][capacity].focuses.add(focus);
    }

    // Calculate signals for each capacity bar
    for (const region of Object.keys(coverageData)) {
        for (const capacity of Object.keys(coverageData[region])) {
            const capData = coverageData[region][capacity];
            const exercises = capData.exercises;
            const highExercises = exercises.filter(e => e.contribution === 'high');
            const mediumExercises = exercises.filter(e => e.contribution === 'medium');
            const lowExercises = exercises.filter(e => e.contribution === 'low');
            const focuses = Array.from(capData.focuses);

            const capHistory7 = new Map();
            const capHistory21 = new Map();
            const capLastDone = new Map();
            for (const ex of exercises) {
                capHistory7.set(ex.id, ex.days7);
                capHistory21.set(ex.id, ex.days21);
                if (ex.lastDone) capLastDone.set(ex.id, ex.lastDone);
            }

            const barData = {
                high_exercises: highExercises,
                medium_exercises: mediumExercises,
                low_exercises: lowExercises,
                history_7_days: capHistory7,
                history_21_days: capHistory21,
                last_done_dates: capLastDone,
                current_date: currentDate,
                focuses: focuses.length > 1 ? focuses : null,
            };

            capData.percent = calculatePercent(barData);
            capData.color_score = calculateColorScore(barData);
            capData.opacity = calculateOpacity(barData);
            capData.color = colorScoreToRGB(capData.color_score);
        }

        // Region-level aggregate
        const capacityBars = Object.values(coverageData[region]);
        coverageData[region]._regionBar = calculateRegionBar(capacityBars);
    }

    // Summary stats
    const exercisesDone7Days = new Set();
    for (const [key] of history7Days) {
        if (!key.includes('_7_')) exercisesDone7Days.add(key);
    }
    const totalExercises = new Set(roles.map(r => r.exercise_id)).size;
    const coverage7 = totalExercises > 0
        ? Math.round((exercisesDone7Days.size / totalExercises) * 100) : 0;

    let mostRecentDate = null;
    for (const [, date] of lastDoneDates) {
        if (!mostRecentDate || date > mostRecentDate) mostRecentDate = date;
    }

    let totalOpacity = 0, regionCount = 0;
    for (const region of Object.keys(coverageData)) {
        const regionBar = coverageData[region]._regionBar;
        if (regionBar && typeof regionBar.opacity === 'number') {
            totalOpacity += regionBar.opacity;
            regionCount++;
        }
    }
    const avgOpacity = regionCount > 0 ? Math.round(totalOpacity / regionCount) : 0;

    return {
        coverageData,
        currentDate,
        summary: {
            lastDoneAgo: mostRecentDate ? daysBetween(mostRecentDate, currentDate) : null,
            coverage7,
            exercisesDone7: exercisesDone7Days.size,
            totalExercises,
            avgOpacity,
        },
    };
}

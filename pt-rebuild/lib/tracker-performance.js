// lib/tracker-performance.js — browser-only timing marks for tracker bootstrap phases
const MARKS = {
    bootstrapStart: 'tracker:bootstrap:start',
    primaryReady: 'tracker:bootstrap:primary-ready',
    historyReady: 'tracker:bootstrap:history-ready',
    pickerReady: 'tracker:ui:picker-ready',
};

const MEASURES = {
    primaryLoad: 'tracker:bootstrap:primary-load',
    historyLoad: 'tracker:bootstrap:history-load',
    pickerLoad: 'tracker:ui:picker-load',
};

function getPerformanceApi() {
    if (typeof window === 'undefined' || typeof window.performance === 'undefined') {
        return null;
    }
    return window.performance;
}

function resetEntry(perf, name, clearFn) {
    try {
        perf[clearFn]?.(name);
    } catch {}
}

function mark(name) {
    const perf = getPerformanceApi();
    if (!perf) return;

    resetEntry(perf, name, 'clearMarks');
    perf.mark(name);
}

function measure(name, startMark, endMark) {
    const perf = getPerformanceApi();
    if (!perf) return;

    resetEntry(perf, name, 'clearMeasures');
    try {
        perf.measure(name, startMark, endMark);
    } catch {}
}

export function markTrackerBootstrapStart() {
    mark(MARKS.bootstrapStart);
}

export function markTrackerPrimaryReady() {
    mark(MARKS.primaryReady);
    measure(MEASURES.primaryLoad, MARKS.bootstrapStart, MARKS.primaryReady);
}

export function markTrackerHistoryReady() {
    mark(MARKS.historyReady);
    measure(MEASURES.historyLoad, MARKS.bootstrapStart, MARKS.historyReady);
}

export function markTrackerPickerReady() {
    mark(MARKS.pickerReady);
    measure(MEASURES.pickerLoad, MARKS.bootstrapStart, MARKS.pickerReady);
}

export const trackerPerformanceNames = {
    marks: MARKS,
    measures: MEASURES,
};

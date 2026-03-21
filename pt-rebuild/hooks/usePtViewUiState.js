// hooks/usePtViewUiState.js — manages persisted ui state and note shaping for the rehab history route
import { useEffect, useMemo, useState } from 'react';
import { detectKeywords } from '../lib/pt-view';
import { offlineCache } from '../lib/offline-cache';

export function usePtViewUiState(logs) {
    const [filters, setFilters] = useState({ exercise: '', dateFrom: '', dateTo: '', query: '' });
    const [notesCollapsed, setNotesCollapsed] = useState(false);
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [dismissedNotes, setDismissedNotes] = useState([]);
    const [uiStateLoaded, setUiStateLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadUiState() {
            try {
                await offlineCache.init();
                const [nextNotesCollapsed, nextFiltersExpanded, nextDismissedNotes] = await Promise.all([
                    offlineCache.getUiState('pt_view_notes_collapsed', false),
                    offlineCache.getUiState('pt_view_filters_expanded', false),
                    offlineCache.getUiState('pt_view_dismissed_notes', []),
                ]);
                if (cancelled) return;
                setNotesCollapsed(Boolean(nextNotesCollapsed));
                setFiltersExpanded(Boolean(nextFiltersExpanded));
                setDismissedNotes(Array.isArray(nextDismissedNotes) ? nextDismissedNotes : []);
                setUiStateLoaded(true);
            } catch {
                if (!cancelled) setUiStateLoaded(true);
            }
        }

        void loadUiState();

        return () => {
            cancelled = true;
        };
    }, []);

    const processedNotes = useMemo(() => logs
        .filter((log) => log.notes && !dismissedNotes.includes(log.id))
        .slice(0, 10)
        .map((log) => {
            const keywords = detectKeywords(log.notes);
            const isConcerning = keywords.length > 0;
            let displayText = log.notes;
            if (isConcerning) {
                keywords.forEach((word) => {
                    displayText = displayText.replace(
                        new RegExp(`(${word})`, 'gi'),
                        '<span class="concerning-word">$1</span>'
                    );
                });
            }
            return { ...log, isConcerning, displayText };
        }), [dismissedNotes, logs]);

    function dismissNote(logId) {
        const next = [...dismissedNotes, logId];
        setDismissedNotes(next);
        void offlineCache.setUiState('pt_view_dismissed_notes', next);
    }

    function toggleNotesCollapsed() {
        const next = !notesCollapsed;
        setNotesCollapsed(next);
        void offlineCache.setUiState('pt_view_notes_collapsed', next);
    }

    function toggleFilters() {
        const next = !filtersExpanded;
        setFiltersExpanded(next);
        void offlineCache.setUiState('pt_view_filters_expanded', next);
    }

    return {
        filters,
        setFilters,
        notesCollapsed,
        filtersExpanded,
        uiStateLoaded,
        processedNotes,
        dismissNote,
        toggleNotesCollapsed,
        toggleFilters,
    };
}

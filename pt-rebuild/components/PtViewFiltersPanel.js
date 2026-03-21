// components/PtViewFiltersPanel.js — page-only filters panel for the rehab history route
import NativeSelect from './NativeSelect';
import styles from './PtViewFiltersPanel.module.css';

export default function PtViewFiltersPanel({ filters, programs, expanded, onToggle, onChange }) {
    return (
        <div className={styles['filters-section']}>
            <div className={styles['filters-toggle']} onPointerUp={onToggle}>
                {expanded ? 'Hide filters' : 'Show filters'}
            </div>
            {expanded && (
                <div className={styles['filters-content']}>
                    <div className={styles['filter-group']}>
                        <label>Exercise</label>
                        <NativeSelect
                            value={filters.exercise}
                            onChange={(value) => onChange({ ...filters, exercise: value })}
                            placeholder="All exercises"
                            options={programs.map((program) => ({
                                value: program.exercise_id,
                                label: program.exercise_name,
                            }))}
                        />
                    </div>
                    <div className={styles['filter-group']}>
                        <label>Date range</label>
                        <div className={styles['date-range']}>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
                            />
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
                            />
                        </div>
                    </div>
                    <div className={styles['filter-group']}>
                        <label>Search</label>
                        <input
                            type="text"
                            placeholder="Exercise name or notes…"
                            value={filters.query}
                            onChange={(event) => onChange({ ...filters, query: event.target.value })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

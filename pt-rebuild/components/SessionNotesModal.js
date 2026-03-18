// components/SessionNotesModal.js — tracker finish-session notes and optional backdate modal
import styles from './SessionNotesModal.module.css';

export default function SessionNotesModal({
    isOpen,
    notes,
    backdateEnabled,
    backdateValue,
    warningVisible,
    onClose,
    onCancel,
    onNotesChange,
    onToggleBackdate,
    onBackdateChange,
    onSave,
}) {
    if (!isOpen) return null;

    return (
        <div
            className={styles.overlay}
            onPointerUp={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section className={styles.modal} aria-label="Session notes">
                <div className={styles.header}>
                    <h2 className={styles.title}>Notes (Optional)</h2>
                    <button type="button" className={styles.closeButton} onPointerUp={onClose}>
                        Close
                    </button>
                </div>

                <label className={styles.label}>
                    <textarea
                        className={styles.textarea}
                        placeholder="How did it feel? Any pain? Progress notes..."
                        value={notes}
                        onChange={(event) => onNotesChange(event.target.value)}
                    />
                </label>

                <div className={styles.backdateBlock}>
                    <button type="button" className={styles.backdateButton} onPointerUp={onToggleBackdate}>
                        Change Date/Time
                    </button>
                    {backdateEnabled && (
                        <div className={styles.backdateContainer}>
                            <input
                                type="datetime-local"
                                className={styles.backdateInput}
                                value={backdateValue}
                                onChange={(event) => onBackdateChange(event.target.value)}
                            />
                            {warningVisible && (
                                <div className={styles.warning}>
                                    Date/time changed from now. Session will be logged at the selected time.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.actions}>
                    <button type="button" className={styles.secondaryButton} onPointerUp={onCancel}>
                        Cancel
                    </button>
                    <button type="button" className={styles.primaryButton} onPointerUp={onSave}>
                        Save & Finish
                    </button>
                </div>
            </section>
        </div>
    );
}

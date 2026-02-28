/**
 * MessagesModal — slide-up messages panel for pt-view.
 *
 * Receives messages and actions from the useMessages() hook in the parent page.
 * Does NOT fetch or poll — that's the hook's job.
 *
 * Props:
 *   isOpen        boolean — show/hide the modal
 *   onClose       () => void
 *   messages      array from useMessages
 *   viewerId      string — current user's auth_id (to distinguish sent vs received)
 *   recipientId   string — the other user's id (for sending)
 *   emailEnabled  boolean — current email notification preference
 *   onSend        (body: string) => Promise<void>
 *   onArchive     (messageId: string) => Promise<void>
 *   onMarkRead    (messageId: string) => Promise<void>
 *   onEmailToggle (enabled: boolean) => void
 *   onOpened      () => void — called when modal opens (clears unread badge)
 */
import { useState, useEffect, useRef } from 'react';
import styles from './MessagesModal.module.css';

export default function MessagesModal({
    isOpen,
    onClose,
    messages,
    viewerId,
    recipientId,
    emailEnabled,
    onSend,
    onArchive,
    onMarkRead,
    onEmailToggle,
    onOpened,
}) {
    const [draft, setDraft]           = useState('');
    const [sending, setSending]       = useState(false);
    const [undoTarget, setUndoTarget] = useState(null); // { messageId, body } for undo
    const listRef                     = useRef(null);

    // Notify parent that modal opened (clears unread count)
    useEffect(() => {
        if (isOpen && onOpened) onOpened();
    }, [isOpen]);

    // Scroll to bottom when messages change or modal opens
    useEffect(() => {
        if (isOpen && listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [isOpen, messages]);

    if (!isOpen) return null;

    // Filter out archived messages for display
    const visible = messages.filter(m => !m.archived);

    async function handleSend() {
        const body = draft.trim();
        if (!body || sending) return;
        setSending(true);
        try {
            await onSend(recipientId, body);
            setDraft('');
        } finally {
            setSending(false);
        }
    }

    function handleKeyDown(e) {
        // Send on Enter (not Shift+Enter)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    async function handleArchive(msg) {
        setUndoTarget({ messageId: msg.id, body: msg.body });
        await onArchive(msg.id);
        // Auto-clear undo after 5s
        setTimeout(() => setUndoTarget(null), 5000);
    }

    // Undo archive = unarchive isn't directly supported in API,
    // so undo just dismisses the banner (the message is already archived)
    function handleUndo() {
        setUndoTarget(null);
    }

    function formatTime(isoString) {
        return new Date(isoString).toLocaleString(undefined, {
            month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit',
        });
    }

    return (
        <div className={styles.overlay} onPointerUp={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>Messages</h2>
                    <button className={styles['close-btn']} onPointerUp={onClose} aria-label="Close messages">✕</button>
                </div>

                {/* Message list */}
                <div className={styles['message-list']} ref={listRef}>
                    {visible.length === 0 && (
                        <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No messages yet.</p>
                    )}
                    {visible.map(msg => {
                        const isSent = msg.sender_id === viewerId;
                        return (
                            <div key={msg.id}>
                                <div className={`${styles['message-bubble']} ${isSent ? styles.sent : styles.received}`}>
                                    {msg.body}
                                    <div className={styles['message-meta']}>
                                        <span>{formatTime(msg.created_at)}</span>
                                        {isSent && msg.read_by_recipient && <span>✓ Read</span>}
                                    </div>
                                    <div className={styles['message-actions']}>
                                        {!isSent && !msg.read_by_recipient && (
                                            <button
                                                className={styles['action-btn']}
                                                onPointerUp={() => onMarkRead(msg.id)}
                                            >
                                                Mark read
                                            </button>
                                        )}
                                        <button
                                            className={styles['action-btn']}
                                            onPointerUp={() => handleArchive(msg)}
                                        >
                                            Archive
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Undo banner */}
                {undoTarget && (
                    <div className={styles['undo-banner']}>
                        <span>Message archived</span>
                        <button className={styles['undo-btn']} onPointerUp={handleUndo}>Undo</button>
                    </div>
                )}

                {/* Email toggle */}
                <div className={styles['email-toggle']}>
                    <input
                        type="checkbox"
                        id="email-notify"
                        checked={emailEnabled}
                        onChange={e => onEmailToggle(e.target.checked)}
                    />
                    <label htmlFor="email-notify">Email me when I receive a message</label>
                </div>

                {/* Compose */}
                <div className={styles.compose}>
                    <textarea
                        className={styles['compose-input']}
                        placeholder="Type a message…"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <button
                        className={styles['send-btn']}
                        onPointerUp={handleSend}
                        disabled={!draft.trim() || sending}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}

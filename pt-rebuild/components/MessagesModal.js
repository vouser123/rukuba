/**
 * MessagesModal — slide-up messages panel for pt-view and index.
 *
 * Receives messages and actions from the useMessages() hook in the parent page.
 * Does NOT fetch or poll — that's the hook's job.
 *
 * Archived messages are hidden from the normal list. A "Show N archived" checkbox
 * at the bottom reveals them as compact one-liners with a Restore button.
 * Tapping a message body collapses it to a preview (local state, no DB write).
 * Tapping again expands it.
 *
 * ID note: viewerId must be the users table PK (profile id), not the Supabase
 * auth UUID, because clinical_messages.sender_id stores the profile id.
 *
 * Props:
 *   isOpen           boolean — show/hide the modal
 *   onClose          () => void
 *   messages         array from useMessages (includes is_archived flag)
 *   viewerId         string — current user's profile id (users table PK)
 *   viewerName       string — current user's first name (for sender label)
 *   otherName        string — other participant's first name
 *   otherIsTherapist boolean — whether the other participant is the therapist
 *   recipientId      string — the other user's profile id (for sending)
 *   emailEnabled     boolean — current email notification preference
 *   onSend           (recipientId: string, body: string) => Promise<void>
 *   onArchive        (messageId: string) => Promise<void>
 *   onUnarchive      (messageId: string) => Promise<void>
 *   onRemove         (messageId: string) => Promise<void> — permanent delete (undo-send)
 *   onMarkRead       (messageId: string) => Promise<void>
 *   onEmailToggle    (enabled: boolean) => void
 *   onOpened         () => void — called when modal opens (clears unread badge)
 */
import { useState, useEffect, useRef } from 'react';
import styles from './MessagesModal.module.css';

const ONE_HOUR_MS = 60 * 60 * 1000;

export default function MessagesModal({
    isOpen,
    onClose,
    messages,
    viewerId,
    viewerName,
    otherName,
    otherIsTherapist,
    recipientId,
    emailEnabled,
    onSend,
    onArchive,
    onUnarchive,
    onRemove,
    onMarkRead,
    onEmailToggle,
    onOpened,
}) {
    const [draft, setDraft]             = useState('');
    const [sending, setSending]         = useState(false);
    // Local collapse state for non-archived messages (tap body to roll up/expand)
    const [collapsedIds, setCollapsedIds] = useState(new Set());
    // Show archived messages at bottom of list
    const [showArchived, setShowArchived] = useState(false);
    const listRef                       = useRef(null);

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

    // Reset local state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setCollapsedIds(new Set());
            setShowArchived(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    function resolveReplyRecipientId() {
        const participant = messages.find(msg =>
            msg.sender_id !== viewerId || msg.recipient_id !== viewerId
        );
        if (!participant) return recipientId;
        return participant.sender_id === viewerId ? participant.recipient_id : participant.sender_id;
    }

    async function handleSend() {
        const body = draft.trim();
        if (!body || sending) return;
        const targetId = resolveReplyRecipientId();
        if (!targetId || targetId === viewerId) return;
        setSending(true);
        try {
            await onSend(targetId, body);
            setDraft('');
        } finally {
            setSending(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    /** Toggle local collapse for a non-archived message (tap body to roll up/expand). */
    function toggleCollapse(messageId) {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(messageId)) next.delete(messageId);
            else next.add(messageId);
            return next;
        });
    }

    /**
     * Undo send — permanently deletes a message within the 1-hour window.
     * Matches static pt_view.html undoSendNoteView behavior.
     */
    async function handleUndoSend(msg) {
        if (!window.confirm('Delete this message? It will be removed for both you and the recipient.')) return;
        await onRemove(msg.id);
    }

    /**
     * Format a message timestamp as "sent: Mon 3/2/26 8:18 PM EST"
     * Matches the static pt_view.html formatMessageDateTime format.
     * @param {string} isoString - ISO date string
     * @param {string} [prefix='sent:'] - Label prefix
     */
    function formatMsgDateTime(isoString, prefix = 'sent:') {
        const date = new Date(isoString);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = days[date.getDay()];
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = String(date.getFullYear()).slice(-2);
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        let tz = '';
        try {
            const tzParts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(date);
            const tzPart = tzParts.find(p => p.type === 'timeZoneName');
            if (tzPart) tz = tzPart.value;
        } catch (e) {
            tz = 'local';
        }
        return `${prefix} ${dayName} ${month}/${day}/${year} ${hours}:${minutes} ${ampm} ${tz}`;
    }

    /**
     * Build the "From > To" sender label for a message.
     * Shows role only for the therapist side: "Cindi > Melanie (PT)" or "Melanie (PT) > Cindi".
     */
    function getSenderLabel(isSent) {
        const viewer = viewerName || 'You';
        const other = otherIsTherapist
            ? `${otherName || 'PT'} (PT)`
            : (otherName || 'PT');
        return isSent ? `${viewer} > ${other}` : `${other} > ${viewer}`;
    }

    const archivedCount = messages.filter(m => m.is_archived).length;
    const activeMessages = messages.filter(m => !m.is_archived);

    return (
        <div className={styles.overlay} onPointerUp={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>Messages</h2>
                    <button className={styles['close-btn']} onPointerUp={onClose} aria-label="Close messages">✕</button>
                </div>

                {/* Message list */}
                <div className={styles['message-list']} ref={listRef}>
                    {activeMessages.length === 0 && !showArchived && (
                        <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                            No messages yet. Send a message to your PT!
                        </p>
                    )}

                    {/* Active (non-archived) messages */}
                    {activeMessages.map(msg => {
                        const isSent = msg.sender_id === viewerId;
                        const canUndoSend = isSent && (Date.now() - new Date(msg.created_at).getTime() < ONE_HOUR_MS);
                        const isCollapsed = collapsedIds.has(msg.id);
                        const senderLabel = getSenderLabel(isSent);

                        // Locally collapsed — compact one-liner, tap to expand
                        if (isCollapsed) {
                            return (
                                <div
                                    key={msg.id}
                                    className={`${styles['rolled-up']} ${isSent ? styles['rolled-up-sent'] : styles['rolled-up-received']}`}
                                    onPointerUp={() => toggleCollapse(msg.id)}
                                >
                                    <span className={styles['rolled-up-label']}>{senderLabel}</span>
                                    <span className={styles['rolled-up-preview']}>
                                        {msg.body.length > 50 ? msg.body.slice(0, 50) + '…' : msg.body}
                                    </span>
                                </div>
                            );
                        }

                        // Full bubble — tap body to collapse
                        return (
                            <div key={msg.id}>
                                <div
                                    className={`${styles['message-bubble']} ${isSent ? styles.sent : styles.received}`}
                                    onPointerUp={() => toggleCollapse(msg.id)}
                                >
                                    <div className={styles['sender-label']}>{senderLabel}</div>
                                    {msg.body}
                                    <div className={styles['message-meta']}>
                                        <span>{formatMsgDateTime(msg.created_at, 'sent:')}</span>
                                        {isSent && (
                                            msg.read_at
                                                ? <span className={styles['read-receipt']}>{formatMsgDateTime(msg.read_at, 'read at:')}</span>
                                                : <span className={styles['delivered']}>Delivered</span>
                                        )}
                                    </div>
                                    <div className={styles['message-actions']} onPointerUp={e => e.stopPropagation()}>
                                        {!isSent && !msg.read_by_recipient && (
                                            <button
                                                className={styles['action-btn']}
                                                onPointerUp={() => onMarkRead(msg.id)}
                                            >
                                                Mark read
                                            </button>
                                        )}
                                        {canUndoSend && (
                                            <button
                                                className={styles['action-btn']}
                                                onPointerUp={() => handleUndoSend(msg)}
                                            >
                                                Undo Send
                                            </button>
                                        )}
                                        <button
                                            className={styles['action-btn']}
                                            onPointerUp={() => onArchive(msg.id)}
                                        >
                                            Archive
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Archived messages — only when showArchived is checked */}
                    {showArchived && messages.filter(m => m.is_archived).map(msg => {
                        const isSent = msg.sender_id === viewerId;
                        const senderLabel = getSenderLabel(isSent);
                        return (
                            <div
                                key={msg.id}
                                className={`${styles['rolled-up']} ${isSent ? styles['rolled-up-sent'] : styles['rolled-up-received']}`}
                            >
                                <span className={styles['rolled-up-label']}>{senderLabel}</span>
                                <span className={styles['rolled-up-preview']}>
                                    {msg.body.length > 60 ? msg.body.slice(0, 60) + '…' : msg.body}
                                </span>
                                <button className={styles['action-btn']} onPointerUp={() => onUnarchive(msg.id)}>Restore</button>
                            </div>
                        );
                    })}
                </div>

                {/* Email notification toggle */}
                <div className={styles['email-toggle']}>
                    <input
                        type="checkbox"
                        id="email-notify"
                        checked={emailEnabled}
                        onChange={e => onEmailToggle(e.target.checked)}
                    />
                    <label htmlFor="email-notify">Email me when I receive a message</label>
                </div>

                {/* Show archived toggle — only visible when there are archived messages */}
                {archivedCount > 0 && (
                    <div className={styles['email-toggle']}>
                        <input
                            type="checkbox"
                            id="show-archived"
                            checked={showArchived}
                            onChange={e => setShowArchived(e.target.checked)}
                        />
                        <label htmlFor="show-archived">
                            Show {archivedCount} archived message{archivedCount !== 1 ? 's' : ''}
                        </label>
                    </div>
                )}

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

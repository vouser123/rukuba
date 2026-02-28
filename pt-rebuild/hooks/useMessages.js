/**
 * useMessages — fetch, poll, send, and archive messages.
 *
 * Handles the 30-second polling interval and cleans up on unmount.
 * The page passes in the viewer's auth_id for badge count calculations.
 *
 * @param {string|null} token  Supabase access token (null when signed out)
 * @param {string|null} viewerId  Current user's auth_id
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    fetchMessages,
    sendMessage,
    patchMessage,
    deleteMessage,
    countUnreadMessages,
    countRecentSent,
} from '../lib/pt-view';

const POLL_INTERVAL_MS = 30_000;

export function useMessages(token, viewerId) {
    const [messages, setMessages]       = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [sentCount, setSentCount]     = useState(0);
    const intervalRef                   = useRef(null);

    // localStorage timestamps — persisted across sessions
    const getLastReadTime  = () => localStorage.getItem('lastReadMessageTime')  ?? new Date(0).toISOString();
    const getLastSentTime  = () => localStorage.getItem('lastSentMessageTime')  ?? new Date(0).toISOString();

    /** Load messages and recompute badge counts. */
    const refresh = useCallback(async () => {
        if (!token) return;
        try {
            const msgs = await fetchMessages(token);
            setMessages(msgs);
            setUnreadCount(countUnreadMessages(msgs, viewerId, getLastReadTime()));
            setSentCount(countRecentSent(msgs, viewerId, getLastSentTime()));
        } catch (err) {
            console.error('useMessages refresh:', err);
        }
    }, [token, viewerId]);

    // Start polling when we have a token; stop on unmount or sign-out
    useEffect(() => {
        if (!token) return;
        refresh();
        intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
        return () => clearInterval(intervalRef.current);
    }, [token, refresh]);

    /** Call when the messages modal opens — marks messages as "read". */
    function markModalOpened() {
        localStorage.setItem('lastReadMessageTime', new Date().toISOString());
        setUnreadCount(0);
    }

    /** Call when the user views their own sent messages. */
    function markSentViewed() {
        localStorage.setItem('lastSentMessageTime', new Date().toISOString());
        setSentCount(0);
    }

    /** Send a new message to recipientId. */
    async function send(recipientId, body) {
        await sendMessage(token, recipientId, body);
        await refresh();
    }

    /** Archive a message. */
    async function archive(messageId) {
        await patchMessage(token, messageId, { archived: true });
        await refresh();
    }

    /** Mark a message read. */
    async function markRead(messageId) {
        await patchMessage(token, messageId, { read: true });
        await refresh();
    }

    /** Permanently delete a message. */
    async function remove(messageId) {
        await deleteMessage(token, messageId);
        await refresh();
    }

    return {
        messages,
        unreadCount,
        sentCount,
        refresh,
        markModalOpened,
        markSentViewed,
        send,
        archive,
        markRead,
        remove,
    };
}

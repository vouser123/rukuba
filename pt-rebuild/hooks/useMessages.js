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
} from '../lib/pt-view';

const POLL_INTERVAL_MS = 30_000;

export function useMessages(token, viewerId) {
    const [messages, setMessages]       = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const intervalRef                   = useRef(null);

    /** Load messages and recompute badge count using DB read_by_recipient field. */
    const refresh = useCallback(async () => {
        if (!token) return;
        try {
            const msgs = await fetchMessages(token);
            setMessages(msgs);
            setUnreadCount(countUnreadMessages(msgs, viewerId));
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

    /** Call when the messages modal opens — clears badge optimistically. */
    function markModalOpened() {
        setUnreadCount(0);
    }

    /** Send a new message to recipientId. */
    async function send(recipientId, body) {
        await sendMessage(token, recipientId, body);
        await refresh();
    }

    /** Archive a message (rolls it up visually). */
    async function archive(messageId) {
        await patchMessage(token, messageId, { archived: true });
        await refresh();
    }

    /** Unarchive a message (restores from rolled-up state). */
    async function unarchive(messageId) {
        await patchMessage(token, messageId, { archived: false });
        await refresh();
    }

    /** Mark a message read. */
    async function markRead(messageId) {
        await patchMessage(token, messageId, { read: true });
        await refresh();
    }

    /** Permanently delete a message (undo-send, within 1-hour window). */
    async function remove(messageId) {
        await deleteMessage(token, messageId);
        await refresh();
    }

    return {
        messages,
        unreadCount,
        refresh,
        markModalOpened,
        send,
        archive,
        unarchive,
        markRead,
        remove,
    };
}

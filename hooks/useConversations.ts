import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from './useApiSubmit';
import type { Conversation, CreateConversationInput, CreateMessageInput, Message } from '@/lib/api/types';

// Every conversation the logged-in user participates in (server-scoped --
// see GET /conversations). No polling here: the conversation list only
// needs to refresh on demand (after sending/reading a message), not on a
// timer -- see useMessages below for the part that actually polls.
export function useConversations() {
  const [data, setData] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.conversations.list();
      setData(res.data.data);
    } catch {
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

const POLL_INTERVAL_MS = 5000;

// A conversation's messages, oldest first for chat display (the API returns
// newest-first for cursor pagination). Polls while a conversation is open --
// CLAUDE.md is explicit that v1 messaging is polling-based, no WebSocket/SSE.
// Opening a conversation (fetching page 1) also marks it read server-side.
export function useMessages(conversationId: string | null) {
  const [data, setData] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!conversationId) {
      setData([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.conversations.messages.list(conversationId);
      setData([...res.data.data].reverse());
      setError(null);
    } catch {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    refetch();
    if (!conversationId) return;
    const interval = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [conversationId, refetch]);

  return { data, loading, error, refetch };
}

export function useSendMessage(conversationId: string) {
  return useApiSubmit((body: CreateMessageInput) =>
    api.conversations.messages.create(conversationId, body).then((res) => res.data.data),
  );
}

// Built for parity with the rest of this domain's hooks (create/list/detail)
// -- not wired to a compose-new-conversation UI this phase. The mock never
// had one either, and every real conversation type (MAINTENANCE_THREAD,
// LEASE_THREAD, COMMUNITY_DISCUSSION) is meant to be started from its own
// context (a maintenance request, a lease, a property), not a bare "new
// message" button, so there's no obvious single entry point to wire yet.
export function useCreateConversation() {
  return useApiSubmit((body: CreateConversationInput) => api.conversations.create(body).then((res) => res.data.data));
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '../_components/ChatPanel';

interface UseChatMessagesOptions {
  documentId: string;
  onNewVersion?: (data: { versionId: string; pdfSignedUrl: string | null; latex: string | null }) => void;
}

export function useChatMessages({ documentId, onNewVersion }: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const resp = await fetch(`/api/documents/${documentId}/chat`);
      if (!resp.ok) return;
      const data = await resp.json();
      setMessages(data.messages ?? []);
    } catch {
      // Non-fatal
    }
  }, [documentId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const sendMessage = useCallback(async (content: string, files?: unknown[]) => {
    setIsSending(true);
    setError(null);

    // Optimistically add user message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const resp = await fetch(`/api/documents/${documentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, files: files ?? [] }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        // Remove optimistic message and show error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        throw new Error(data?.error ?? 'Failed to send message');
      }

      // Reload messages from server to get the real IDs and assistant reply
      await loadMessages();

      // Notify parent if a new version was created
      if (data.versionId && onNewVersion) {
        onNewVersion({
          versionId: data.versionId,
          pdfSignedUrl: data.pdfSignedUrl ?? null,
          latex: data.latex ?? null,
        });
      }

      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsSending(false);
    }
  }, [documentId, loadMessages, onNewVersion]);

  return {
    messages,
    isSending,
    error,
    sendMessage,
    reloadMessages: loadMessages,
  };
}

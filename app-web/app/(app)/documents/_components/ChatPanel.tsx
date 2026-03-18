'use client';

import { useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  version_id?: string | null;
  version_number?: number | null;
  created_at: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isDraft: boolean;
  onSend: (content: string) => void;
  placeholder?: string;
  loadingLabel?: string;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function ChatPanel({ messages, isLoading, isDraft, onSend, placeholder, loadingLabel }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }

  const defaultPlaceholder = isDraft
    ? 'Describe the document you want to create...'
    : (placeholder ?? 'Ask for changes...');

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f] border-l border-gray-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-sm font-semibold text-gray-300">Chat</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-600 text-sm mt-8 space-y-2">
            <p className="text-gray-400 font-medium">
              {isDraft ? 'What would you like to create?' : 'Continue the conversation'}
            </p>
            <p className="text-xs">
              {isDraft
                ? 'Describe your document and the AI will generate it for you.'
                : 'Ask the AI to modify or extend your document.'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>

            {msg.role === 'assistant' && msg.version_id && (
              <div className="flex items-center gap-1 mt-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-teal-400 bg-teal-950/50
                  rounded px-1.5 py-0.5 border border-teal-900/50">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                  </svg>
                  Document updated
                </span>
              </div>
            )}

            <p className={`text-xs text-gray-600 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              {formatTime(msg.created_at)}
            </p>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-xl px-3 py-2.5">
              <div className="flex space-x-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              {loadingLabel && (
                <p className="text-xs text-gray-500 mt-1.5">{loadingLabel}</p>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-800 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={defaultPlaceholder}
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-gray-800 text-gray-200 text-sm rounded-xl px-3 py-2.5 resize-none
              placeholder-gray-600 border border-gray-700 focus:outline-none focus:border-blue-500
              transition-colors disabled:opacity-50 min-h-[40px] max-h-[160px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl
              bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors"
            aria-label="Send"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-1.5">
          Enter to send &middot; Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (!isOpen) return null;

  async function handleUpgrade() {
    setIsRedirecting(true);
    try {
      const resp = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      });
      if (resp.ok) {
        const data = await resp.json();
        window.location.href = data.url;
      } else {
        setIsRedirecting(false);
      }
    } catch {
      setIsRedirecting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-900/60 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-400 transition-colors ml-4"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <h2 className="text-lg font-bold text-white mb-2">Monthly credit limit reached</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          You&apos;ve used all your available credits for this month. Upgrade your plan for
          a higher monthly credit allowance.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleUpgrade}
            disabled={isRedirecting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed
              text-white font-semibold text-sm py-2.5 rounded-xl transition-colors flex items-center
              justify-center gap-2"
          >
            {isRedirecting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Redirecting...
              </>
            ) : (
              'Upgrade to Pro'
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 rounded-xl
              transition-colors border border-transparent hover:border-gray-700"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

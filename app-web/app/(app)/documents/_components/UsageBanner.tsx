'use client';

import { useState } from 'react';
import Link from 'next/link';

interface UsageBannerProps {
  remaining: number;
}

export function UsageBanner({ remaining }: UsageBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isExhausted = remaining === 0;

  const containerClass = isExhausted
    ? 'bg-red-950/60 border-b border-red-900/60 text-red-300'
    : 'bg-amber-950/60 border-b border-amber-900/60 text-amber-300';

  const message = isExhausted
    ? 'No generations left this month'
    : `${remaining} generation${remaining === 1 ? '' : 's'} left this month`;

  return (
    <div className={`flex items-center justify-between px-4 py-2 text-sm shrink-0 ${containerClass}`}>
      <span>
        {message}
        {' · '}
        <Link
          href="/pricing"
          className={`font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity ${
            isExhausted ? 'text-red-200' : 'text-amber-200'
          }`}
        >
          Upgrade
        </Link>
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="ml-4 opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

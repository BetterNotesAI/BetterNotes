'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Notice {
  type: 'success' | 'error';
  message: string;
}

const FAQS = [
  {
    question: 'How are free credits consumed?',
    answer:
      'Each generation increments your monthly usage counter. Free plan usage resets at the beginning of every month.',
  },
  {
    question: 'Where can I see my current usage?',
    answer:
      'Open Billing / Plan to see your current plan, monthly usage, and remaining quota.',
  },
  {
    question: 'How can I upgrade or manage my subscription?',
    answer:
      'From Billing / Plan you can upgrade to Pro or open the Stripe customer portal to manage billing details.',
  },
  {
    question: 'I changed my email or password. Why am I still seeing old info?',
    answer:
      'Some auth updates require email confirmation. Once confirmed, refresh the app and your account details will sync.',
  },
];

export default function SupportPage() {
  const router = useRouter();

  const [category, setCategory] = useState<'general' | 'billing' | 'account' | 'bug' | 'feature-request'>(
    'general'
  );
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (cleanSubject.length < 3) {
      setNotice({ type: 'error', message: 'Subject must be at least 3 characters.' });
      return;
    }

    if (cleanMessage.length < 10) {
      setNotice({ type: 'error', message: 'Message must be at least 10 characters.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subject: cleanSubject,
          message: cleanMessage,
          pagePath: '/support',
        }),
      });

      const body = await response.json().catch(() => ({})) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? 'Could not submit your request.');
      }

      setSubject('');
      setMessage('');
      setNotice({ type: 'success', message: 'Support request sent. We will get back to you soon.' });
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Could not submit your request.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
            >
              <span aria-hidden>←</span>
              Back
            </button>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Support</h1>
            <p className="mt-1 text-sm text-white/60 max-w-2xl">
              Contact us, review common questions, and access legal documentation.
            </p>
          </div>

          <Link
            href="/settings/billing"
            className="px-3 py-2 text-xs rounded-lg border border-white/15 text-white/75 hover:text-white hover:border-white/30 transition-colors"
          >
            Go to Billing / Plan
          </Link>
        </div>

        {notice && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              notice.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                : 'bg-red-500/10 border-red-400/30 text-red-200'
            }`}
          >
            {notice.message}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4"
        >
          <div>
            <h2 className="text-lg font-medium text-white">Contact Form</h2>
            <p className="text-sm text-white/55 mt-1">
              For urgent issues you can also email us at{' '}
              <a href="mailto:hello@better-notes.ai" className="text-indigo-300 hover:text-indigo-200">
                hello@better-notes.ai
              </a>
              .
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block md:col-span-1">
              <span className="text-xs text-white/60">Category</span>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as 'general' | 'billing' | 'account' | 'bug' | 'feature-request'
                  )
                }
                className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white focus:outline-none focus:border-indigo-400/60 transition-colors"
              >
                <option value="general" className="text-black">General</option>
                <option value="billing" className="text-black">Billing</option>
                <option value="account" className="text-black">Account</option>
                <option value="bug" className="text-black">Bug report</option>
                <option value="feature-request" className="text-black">Feature request</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="text-xs text-white/60">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
                placeholder="Short summary"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-white/60">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={1800}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors resize-none"
              placeholder="Describe your question or issue..."
            />
            <span className="mt-1 block text-[11px] text-white/45">{message.length}/1800</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {isSubmitting ? 'Sending...' : 'Send request'}
          </button>
        </form>

        <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
          <h2 className="text-lg font-medium text-white">FAQs</h2>
          <div className="space-y-3">
            {FAQS.map((item) => (
              <div key={item.question} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <h3 className="text-sm font-medium text-white">{item.question}</h3>
                <p className="mt-1 text-sm text-white/60">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
          <h2 className="text-lg font-medium text-white">Documentation</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/support/privacy-policy"
              className="px-3 py-2 text-sm rounded-lg border border-white/20 text-white/80 hover:text-white hover:border-white/35 transition-colors"
            >
              Política de privacidad
            </Link>
            <Link
              href="/support/terms-of-use"
              className="px-3 py-2 text-sm rounded-lg border border-white/20 text-white/80 hover:text-white hover:border-white/35 transition-colors"
            >
              Términos de uso
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

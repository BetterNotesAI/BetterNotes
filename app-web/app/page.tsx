import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/documents')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-800/60 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-white">
            BetterNotes
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
            Generate beautiful study documents in seconds
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
            Choose a template, describe what you need, and get a print-ready PDF
            — powered by AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors text-sm"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-colors text-sm border border-gray-700"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* 3 Steps */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-blue-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 0 0 2.25 2.25h.75"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
                  Step 1
                </p>
                <h3 className="text-base font-semibold text-white">
                  Choose a template
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Pick from 10 academic templates
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-600/30 flex items-center justify-center text-purple-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">
                  Step 2
                </p>
                <h3 className="text-base font-semibold text-white">
                  Describe your content
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Tell the AI what to fill in
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-green-600/20 border border-green-600/30 flex items-center justify-center text-green-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">
                  Step 3
                </p>
                <h3 className="text-base font-semibold text-white">
                  Download your PDF
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Print-ready in seconds
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-24">
        <div className="max-w-xl mx-auto text-center space-y-5 bg-gray-900/40 border border-gray-800 rounded-2xl p-10">
          <h2 className="text-2xl font-bold text-white">
            Ready to study smarter?
          </h2>
          <Link
            href="/signup"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors text-sm"
          >
            Create your first document
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/60 px-6 py-5 text-center">
        <p className="text-xs text-gray-600">© 2026 BetterNotes</p>
      </footer>
    </div>
  )
}

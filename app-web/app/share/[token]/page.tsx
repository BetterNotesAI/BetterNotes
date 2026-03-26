import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

interface SharePageProps {
  params: Promise<{ token: string }>;
}

async function getSharedDocument(token: string) {
  const supabase = createAdminClient();

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, title, template_id, current_version_id')
    .eq('share_token', token)
    .single();

  if (error || !doc) return null;

  let pdfSignedUrl: string | null = null;

  if (doc.current_version_id) {
    const { data: version } = await supabase
      .from('document_versions')
      .select('pdf_storage_path')
      .eq('id', doc.current_version_id)
      .eq('document_id', doc.id)
      .maybeSingle();

    if (version?.pdf_storage_path) {
      const { data: signedUrlData } = await supabase.storage
        .from('documents-output')
        .createSignedUrl(version.pdf_storage_path, 3600);
      pdfSignedUrl = signedUrlData?.signedUrl ?? null;
    }
  }

  return { doc, pdfSignedUrl };
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await getSharedDocument(token);
  const title = result?.doc.title ?? 'Shared document';
  return {
    title: `${title} — BetterNotes`,
    description: 'View this document shared via BetterNotes',
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const result = await getSharedDocument(token);

  if (!result) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-white/8 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white">Link not found</h1>
          <p className="text-sm text-white/50 leading-relaxed">
            This share link may have expired or the document no longer exists.
          </p>
          <a
            href="/"
            className="inline-block mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
              text-white text-sm font-medium transition-colors"
          >
            Create your own with BetterNotes
          </a>
        </div>
      </div>
    );
  }

  const { doc, pdfSignedUrl } = result;

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10
        bg-neutral-950/90 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <a href="/" className="flex items-center gap-1.5 shrink-0 group">
            <span className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
              BetterNotes
            </span>
          </a>
          <span className="text-white/20 hidden sm:block">/</span>
          <h1 className="text-sm font-medium text-white/70 truncate hidden sm:block">
            {doc.title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* View-only badge */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
            bg-white/8 border border-white/15 text-xs text-white/55 font-medium select-none">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View only
          </span>

          <a
            href="/"
            className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg
              bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
          >
            Create your own
          </a>
        </div>
      </header>

      {/* Coming-soon collaboration banner */}
      <div className="flex items-center justify-center gap-2 px-4 py-2
        bg-indigo-950/40 border-b border-indigo-500/20 text-xs text-indigo-300/75 text-center">
        <svg className="w-3.5 h-3.5 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Collaborative editing coming soon &mdash; real-time co-editing with BetterNotes Pro
      </div>

      {/* Mobile title */}
      <div className="sm:hidden px-4 pt-4 pb-1">
        <h1 className="text-base font-semibold text-white truncate">{doc.title}</h1>
      </div>

      {/* PDF viewer */}
      <main className="flex-1 flex flex-col items-center px-4 py-6 sm:px-6">
        {pdfSignedUrl ? (
          <div
            className="w-full max-w-4xl rounded-xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ height: 'calc(100vh - 130px)', minHeight: '400px' }}
          >
            <iframe
              src={pdfSignedUrl}
              className="w-full h-full"
              title={doc.title}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/6 flex items-center justify-center">
              <svg className="w-7 h-7 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm text-white/40">
              This document doesn&apos;t have a PDF yet.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-3 text-xs text-white/20 border-t border-white/8">
        Shared via{' '}
        <a href="/" className="text-white/35 hover:text-white/55 transition-colors underline underline-offset-2">
          BetterNotes
        </a>
      </footer>
    </div>
  );
}

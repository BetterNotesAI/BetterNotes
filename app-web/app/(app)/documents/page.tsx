'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TemplateSelector, type TemplateMeta } from './_components/TemplateSelector';
import { SpecsModal } from './_components/SpecsModal';
import { DocumentSpecs } from './_types';

interface Document {
  id: string;
  title: string;
  template_id: string;
  status: string;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-gray-500' },
  generating: { label: 'Generating...', color: 'text-blue-400 animate-pulse' },
  ready: { label: 'Ready', color: 'text-green-500' },
  error: { label: 'Error', color: 'text-red-500' },
};

const TEMPLATE_LABELS: Record<string, string> = {
  '2cols_portrait': '2-Col Cheat Sheet',
  landscape_3col_maths: '3-Col Landscape',
  cornell: 'Cornell Notes',
  problem_solving: 'Problem Set',
  zettelkasten: 'Zettelkasten',
  academic_paper: 'Academic Paper',
  lab_report: 'Lab Report',
  data_analysis: 'Data Analysis',
  study_form: 'Study Form',
  lecture_notes: 'Lecture Notes',
  long_template: 'Long Document',
};

// Static template list (matches what the backend serves)
const TEMPLATES: TemplateMeta[] = [
  { id: '2cols_portrait', displayName: '2-Column Cheat Sheet', description: 'Compact portrait sheet with 2 columns for formulas, definitions, and key results.', isPro: false },
  { id: 'landscape_3col_maths', displayName: '3-Column Landscape', description: 'A4 landscape with 3 columns — dense math reference sheets and formula summaries.', isPro: false },
  { id: 'cornell', displayName: 'Cornell Notes', description: 'Classic Cornell format with cue keywords in the left margin and a summary box.', isPro: false },
  { id: 'problem_solving', displayName: 'Problem Solving Worksheet', description: 'Structured problem/given/solution blocks with boxed answers for STEM practice.', isPro: false },
  { id: 'zettelkasten', displayName: 'Zettelkasten Cards', description: 'Knowledge cards with cross-references and tags in Zettelkasten style.', isPro: false },
  { id: 'study_form', displayName: 'Study Form (High Density)', description: '3-column ultra-compact A4 with formula boxes, constant tables, and property lists.', isPro: false },
  { id: 'lecture_notes', displayName: 'Lecture Notes', description: 'Multi-page structured notes with objectives, examples, and a summary box.', isPro: false },
  { id: 'academic_paper', displayName: 'Academic Paper', description: 'Two-column AMS/Physical Review style paper with abstract, theorems, and bibliography.', isPro: true },
  { id: 'lab_report', displayName: 'Lab Report', description: 'Technical report with experimental setup, data tables with uncertainties, and error analysis.', isPro: true },
  { id: 'data_analysis', displayName: 'Data Analysis Report', description: 'Statistics or ML report with Python code listings, results tables, and math.', isPro: true },
];

interface SpecsStep {
  id: string;
  displayName: string;
  description: string;
}

const ONBOARDING_STEPS = [
  {
    step: '1',
    title: 'Choose a template',
    desc: '10 academic templates — cheat sheets, notes, problem sets',
    icon: (
      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    step: '2',
    title: 'Describe the content',
    desc: 'Tell the AI what to fill in — topic, examples, formulas',
    icon: (
      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    step: '3',
    title: 'Download your PDF',
    desc: 'Print-ready in seconds, refine with follow-up messages',
    icon: (
      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
];

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [specsStep, setSpecsStep] = useState<SpecsStep | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setIsLoadingDocs(true);
    try {
      const resp = await fetch('/api/documents');
      if (resp.ok) {
        const data = await resp.json();
        setDocuments(data.documents ?? []);
      }
    } finally {
      setIsLoadingDocs(false);
    }
  }

  function handleCloseModal() {
    setShowNewDocModal(false);
    setSpecsStep(null);
  }

  function handleChooseTemplate(templateId: string) {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setSpecsStep({
      id: template.id,
      displayName: template.displayName,
      description: template.description,
    });
  }

  async function handleConfirmWithSpecs(templateId: string, specs: DocumentSpecs) {
    setIsCreating(true);
    setCreateError(null);
    try {
      const resp = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, specs }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setCreateError(data?.error ?? 'Failed to create document. Please try again.');
        return;
      }
      router.push(`/documents/${data.document.id}`);
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteDocument(e: React.MouseEvent, docId: string) {
    e.stopPropagation();
    if (!confirm('Delete this document? This cannot be undone.')) return;
    await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="h-full overflow-y-auto bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Documents</h1>
        <button
          onClick={() => setShowNewDocModal(true)}
          className="flex items-center gap-2 bg-white hover:bg-white/90 text-neutral-950 text-sm
            font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Document
        </button>
      </div>

      {/* Document list */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoadingDocs ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          /* Onboarding empty state */
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-white mb-2">Create your first document</h2>
            <p className="text-white/55 text-sm mb-10">Let AI generate a print-ready PDF from your notes.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
              {ONBOARDING_STEPS.map(({ step, icon, title, desc }) => (
                <div
                  key={step}
                  className="bg-white/10 border border-white/20 rounded-2xl p-5 text-left backdrop-blur"
                >
                  <div className="mb-3">{icon}</div>
                  <p className="text-xs text-white/40 font-medium mb-1">Step {step}</p>
                  <p className="text-sm font-semibold text-white mb-1">{title}</p>
                  <p className="text-xs text-white/55">{desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowNewDocModal(true)}
              className="bg-white hover:bg-white/90 text-neutral-950 font-semibold px-6 py-3 rounded-xl
                transition-colors text-sm"
            >
              Get started
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => {
              const statusInfo = STATUS_LABELS[doc.status] ?? { label: doc.status, color: 'text-gray-500' };
              return (
                <div
                  key={doc.id}
                  className="relative text-left bg-white/10 border border-white/20 rounded-xl p-4
                    hover:bg-white/15 hover:border-white/30 backdrop-blur transition-all group cursor-pointer"
                  onClick={() => router.push(`/documents/${doc.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white truncate pr-2 leading-snug">
                      {doc.title}
                    </h3>
                    <button
                      onClick={(e) => handleDeleteDocument(e, doc.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-0.5 rounded"
                      aria-label="Delete document"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-white/50 mb-3">
                    {TEMPLATE_LABELS[doc.template_id] ?? doc.template_id}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <span className="text-xs text-white/30">
                      {formatDate(doc.updated_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Document modal — 2-step flow */}
      {showNewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-black/60 border border-white/20 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col backdrop-blur-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <h2 className="text-lg font-semibold text-white">New Document</h2>
              <button
                onClick={handleCloseModal}
                className="text-white/40 hover:text-white/80 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {specsStep === null ? (
              /* Step 1 — Template selector */
              <div className="flex-1 overflow-y-auto">
                <TemplateSelector
                  templates={TEMPLATES}
                  onChoose={handleChooseTemplate}
                  isLoading={isCreating}
                />
              </div>
            ) : (
              /* Step 2 — Specs modal */
              <div className="flex-1 overflow-y-auto">
                {createError && (
                  <p className="mx-6 mt-4 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                    {createError}
                  </p>
                )}
                <SpecsModal
                  template={specsStep}
                  onConfirm={(specs) => handleConfirmWithSpecs(specsStep.id, specs)}
                  onBack={() => { setSpecsStep(null); setCreateError(null); }}
                  isLoading={isCreating}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

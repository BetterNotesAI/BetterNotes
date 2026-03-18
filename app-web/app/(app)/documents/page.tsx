'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TemplateSelector, type TemplateMeta } from './_components/TemplateSelector';

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

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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

  async function handleSelectTemplate(templateId: string) {
    setIsCreating(true);
    try {
      const resp = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId }),
      });
      if (resp.ok) {
        const data = await resp.json();
        router.push(`/documents/${data.document.id}`);
      }
    } finally {
      setIsCreating(false);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">My Documents</h1>
        <button
          onClick={() => setShowNewDocModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm
            font-medium px-4 py-2 rounded-lg transition-colors"
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
            <div className="w-6 h-6 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div
            onClick={() => setShowNewDocModal(true)}
            className="border border-dashed border-gray-700 rounded-2xl p-16 text-center cursor-pointer
              hover:border-gray-500 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center mx-auto mb-4
              group-hover:bg-gray-700 transition-colors">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">Create your first document</p>
            <p className="text-gray-600 text-sm mt-1">Select a template and let AI generate it for you</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => {
              const statusInfo = STATUS_LABELS[doc.status] ?? { label: doc.status, color: 'text-gray-500' };
              return (
                <button
                  key={doc.id}
                  onClick={() => router.push(`/documents/${doc.id}`)}
                  className="text-left bg-gray-900/60 border border-gray-800 rounded-xl p-4
                    hover:border-gray-600 hover:bg-gray-900 transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white truncate pr-2 leading-snug">
                      {doc.title}
                    </h3>
                    {doc.is_starred && (
                      <svg className="w-4 h-4 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {TEMPLATE_LABELS[doc.template_id] ?? doc.template_id}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <span className="text-xs text-gray-700">
                      {formatDate(doc.updated_at)}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* New document card */}
            <button
              onClick={() => setShowNewDocModal(true)}
              className="text-left border border-dashed border-gray-800 rounded-xl p-4
                hover:border-gray-600 transition-all flex items-center justify-center gap-2
                text-gray-600 hover:text-gray-400 min-h-[100px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm">New document</span>
            </button>
          </div>
        )}
      </div>

      {/* Template selector modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
              <h2 className="text-lg font-bold text-white">New Document</h2>
              <button
                onClick={() => setShowNewDocModal(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TemplateSelector
                templates={TEMPLATES}
                onSelect={handleSelectTemplate}
                isLoading={isCreating}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

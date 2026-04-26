'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MAX_ATTACHMENT_FILE_SIZE_BYTES,
  MAX_PROJECT_TOTAL_UPLOAD_BYTES,
  MAX_PROJECT_TOTAL_UPLOAD_MB,
} from '@/lib/upload-limits';
import { savePendingGenerationIntent } from '@/lib/pending-generation-intent';
import { CheatsheetPanel } from './_components/CheatsheetPanel';
import {
  LectureNotesPanel,
  type LectureNotesDensity,
  type ReportTemplateId,
} from './_components/LectureNotesPanel';
import { ProblemSolverPanel } from './_components/ProblemSolverPanel';
import { ExamsPanel } from './_components/ExamsPanel';
import type { ExamSetupValues } from '@/app/(app)/exams/_components/ExamSetup';
import type { CheatSheetTemplateId } from '@/app/(app)/cheat-sheets/_components/cheatSheetTemplates';

type WorkflowId = 'cheat-sheets' | 'lecture-notes' | 'problem-solver' | 'exams';
type NewProjectStep = 'details' | 'workflow';

interface WorkflowOption {
  id: WorkflowId;
  title: string;
  description: string;
  accent: string;
}

interface ProjectColorOption {
  value: string;
  label: string;
}

interface UploadedInputMeta {
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}

const PROJECT_COLOR_OPTIONS: ProjectColorOption[] = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Amber' },
  { value: '#22c55e', label: 'Green' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#94a3b8', label: 'Slate' },
];

const WORKFLOWS: WorkflowOption[] = [
  {
    id: 'cheat-sheets',
    title: 'Cheatsheet',
    description: 'Generate compact formula and concept sheets.',
    accent: 'from-indigo-500/25 to-violet-500/20',
  },
  {
    id: 'lecture-notes',
    title: 'Report',
    description: 'Create notes, papers, lab reports or data analysis documents.',
    accent: 'from-blue-500/25 to-cyan-500/20',
  },
  {
    id: 'problem-solver',
    title: 'Problem Solver',
    description: 'Upload a PDF and solve problems step by step.',
    accent: 'from-orange-500/25 to-amber-500/20',
  },
  {
    id: 'exams',
    title: 'Exams',
    description: 'Generate and take exams in the same notebook.',
    accent: 'from-emerald-500/25 to-teal-500/20',
  },
];

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exp);
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function isSupportedInputFile(file: File): boolean {
  if (ALLOWED_MIME_TYPES.has(file.type)) return true;
  const lowerName = file.name.toLowerCase();
  return (
    lowerName.endsWith('.pdf')
    || lowerName.endsWith('.docx')
    || lowerName.endsWith('.jpg')
    || lowerName.endsWith('.jpeg')
    || lowerName.endsWith('.png')
    || lowerName.endsWith('.webp')
  );
}

function promptIsRequiredFor(workflow: WorkflowId | null): boolean {
  return workflow === 'cheat-sheets' || workflow === 'lecture-notes';
}

function promptPlaceholderFor(workflow: WorkflowId | null): string {
  switch (workflow) {
    case 'problem-solver':
      return 'Notes or extra instructions (optional)...';
    case 'exams':
      return 'Extra context (optional) — exam subject and level are set below.';
    case 'lecture-notes':
      return 'e.g. Create a report about Kirchhoff\'s laws with examples';
    case 'cheat-sheets':
    default:
      return 'e.g. Summarize thermodynamics laws for final exam revision';
  }
}

export default function NewProjectPage() {
  const router = useRouter();

  const [step, setStep] = useState<NewProjectStep>('details');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labelColor, setLabelColor] = useState<string | null>(null);
  const [projectInputFiles, setProjectInputFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState('');
  const [selected, setSelected] = useState<WorkflowId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInputDropDragging, setIsInputDropDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Per-resource configuration state
  const [cheatsheetTemplateId, setCheatsheetTemplateId] = useState<CheatSheetTemplateId | null>(null);
  const [reportTemplateId, setReportTemplateId] = useState<ReportTemplateId | null>(null);
  const [lectureNotesPages, setLectureNotesPages] = useState<number | null>(null);
  const [lectureNotesDensity, setLectureNotesDensity] = useState<LectureNotesDensity | null>(null);
  const [lectureNotesLanguage, setLectureNotesLanguage] = useState<string | null>(null);
  const [problemSolverFile, setProblemSolverFile] = useState<File | null>(null);

  const totalInputBytes = useMemo(
    () => projectInputFiles.reduce((acc, file) => acc + file.size, 0),
    [projectInputFiles]
  );

  const canContinueStepOne = useMemo(
    () => title.trim().length > 0 && !isSubmitting,
    [title, isSubmitting]
  );

  const isResourceConfigReady = useMemo(() => {
    if (!selected) return false;
    if (selected === 'cheat-sheets') return cheatsheetTemplateId !== null;
    if (selected === 'lecture-notes') {
      return (
        reportTemplateId !== null
        && lectureNotesPages !== null
        && lectureNotesDensity !== null
        && lectureNotesLanguage !== null
      );
    }
    if (selected === 'problem-solver') return problemSolverFile !== null;
    if (selected === 'exams') return true; // ExamSetup validates internally
    return false;
  }, [
    selected,
    cheatsheetTemplateId,
    reportTemplateId,
    lectureNotesPages,
    lectureNotesDensity,
    lectureNotesLanguage,
    problemSolverFile,
  ]);

  const canCreateProject = useMemo(() => {
    if (isSubmitting) return false;
    if (!title.trim()) return false;
    if (!selected) return false;
    if (promptIsRequiredFor(selected) && !prompt.trim()) return false;
    if (!isResourceConfigReady) return false;
    return true;
  }, [isSubmitting, title, prompt, selected, isResourceConfigReady]);

  useEffect(() => {
    if (step !== 'workflow') return;
    const el = promptTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 224)}px`;
  }, [step]);

  function resetError() {
    if (error !== null) setError(null);
  }

  function handleSelectResource(nextWorkflow: WorkflowId) {
    setSelected(nextWorkflow);
    resetError();
    // Reset all resource-specific configs when switching resources
    setCheatsheetTemplateId(null);
    setReportTemplateId(null);
    setLectureNotesPages(null);
    setLectureNotesDensity(null);
    setLectureNotesLanguage(null);
    setProblemSolverFile(null);
  }

  function handleBackOrClose() {
    if (step === 'workflow') {
      setStep('details');
      resetError();
      return;
    }
    router.push('/documents');
  }

  function handleGoToWorkflowStep() {
    if (!title.trim()) {
      setError('Add a notebook title to continue.');
      return;
    }
    if (totalInputBytes > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
      setError(`Notebook input file limit exceeded (${MAX_PROJECT_TOTAL_UPLOAD_MB} MB max).`);
      return;
    }
    setStep('workflow');
    resetError();
  }

  function addInputFiles(incoming: File[]) {
    if (incoming.length === 0) return;
    for (const file of incoming) {
      if (!isSupportedInputFile(file)) {
        setError(`Unsupported file type: ${file.name}. Allowed: PDF, DOCX, JPG, PNG, WEBP.`);
        return;
      }
      if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
        setError(`File too large: ${file.name}. Maximum size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB.`);
        return;
      }
    }

    const nextTotal = totalInputBytes + incoming.reduce((acc, file) => acc + file.size, 0);
    if (nextTotal > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
      setError(`Notebook input file limit exceeded (${MAX_PROJECT_TOTAL_UPLOAD_MB} MB max total).`);
      return;
    }

    setProjectInputFiles((prev) => [...prev, ...incoming]);
    resetError();
  }

  function handleInputFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    e.target.value = '';
    addInputFiles(incoming);
  }

  function handleInputDropzoneDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsInputDropDragging(true);
  }

  function handleInputDropzoneDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsInputDropDragging(false);
  }

  function handleInputDropzoneDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsInputDropDragging(false);
    const incoming = Array.from(e.dataTransfer.files ?? []);
    addInputFiles(incoming);
  }

  function handlePromptChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPrompt(e.target.value);
    resetError();
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 224)}px`;
  }

  function removeInputFile(index: number) {
    setProjectInputFiles((prev) => prev.filter((_, i) => i !== index));
    resetError();
  }

  async function uploadProjectInputs(): Promise<UploadedInputMeta[]> {
    const uploaded: UploadedInputMeta[] = [];

    for (const file of projectInputFiles) {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/attachments/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = (await uploadRes.json().catch(() => ({}))) as {
        error?: string;
        name?: string;
        mimeType?: string;
        sizeBytes?: number;
        storagePath?: string;
      };

      if (!uploadRes.ok) {
        throw new Error(uploadData.error ?? `Failed to upload ${file.name}`);
      }
      if (
        !uploadData.name
        || !uploadData.mimeType
        || !uploadData.storagePath
        || typeof uploadData.sizeBytes !== 'number'
      ) {
        throw new Error(`Upload response for ${file.name} is missing required metadata.`);
      }

      uploaded.push({
        name: uploadData.name,
        mimeType: uploadData.mimeType,
        sizeBytes: uploadData.sizeBytes,
        storagePath: uploadData.storagePath,
      });
    }

    return uploaded;
  }

  async function createFolder(uploadedInputs: UploadedInputMeta[]): Promise<string> {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: title.trim(),
        description: description.trim() || undefined,
        color: labelColor ?? undefined,
        inputs: uploadedInputs,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      folder?: { id?: string };
      error?: string;
    };

    if (!res.ok || !data.folder?.id) {
      throw new Error(data.error ?? 'Failed to create notebook');
    }

    window.dispatchEvent(new Event('folders:updated'));
    return data.folder.id;
  }

  async function runCheatsheetFlow(folderId: string, uploadedInputs: UploadedInputMeta[]) {
    if (!cheatsheetTemplateId) throw new Error('Pick a template to continue.');

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: cheatsheetTemplateId,
        prompt: prompt.trim(),
        folder_id: folderId,
        attachments: uploadedInputs,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      document?: { id?: string };
      error?: string;
    };
    if (!res.ok || !data.document?.id) {
      throw new Error(data.error ?? 'Failed to create cheat sheet.');
    }

    const query = new URLSearchParams({ prompt: prompt.trim(), projectId: folderId });
    router.push(`/cheat-sheets/${data.document.id}?${query.toString()}`);
  }

  async function runLectureNotesFlow(folderId: string, uploadedInputs: UploadedInputMeta[]) {
    if (!reportTemplateId) throw new Error('Pick a report template to continue.');

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: reportTemplateId,
        prompt: prompt.trim(),
        folder_id: folderId,
        attachments: uploadedInputs,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      document?: { id?: string };
      error?: string;
    };
    if (!res.ok || !data.document?.id) {
      throw new Error(data.error ?? 'Failed to create report.');
    }

    const query = new URLSearchParams({ prompt: prompt.trim(), projectId: folderId });
    router.push(`/documents/${data.document.id}?${query.toString()}`);
  }

  async function runProblemSolverFlow(folderId: string) {
    if (!problemSolverFile) throw new Error('Upload a PDF to continue.');

    const sessionTitle = prompt.trim() || problemSolverFile.name.replace(/\.pdf$/i, '');

    const createRes = await fetch('/api/problem-solver/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: sessionTitle, folder_id: folderId }),
    });
    if (!createRes.ok) {
      const data = await createRes.json().catch(() => ({}));
      throw new Error(data.error ?? 'Failed to create problem session.');
    }
    const { session } = (await createRes.json()) as { session: { id: string } };

    const formData = new FormData();
    formData.append('file', problemSolverFile);
    const uploadRes = await fetch(
      `/api/problem-solver/sessions/${session.id}/upload-pdf`,
      { method: 'POST', body: formData }
    );
    if (!uploadRes.ok) {
      const data = await uploadRes.json().catch(() => ({}));
      throw new Error(data.error ?? 'Failed to upload problem PDF.');
    }

    router.push(
      `/problem-solver/${session.id}?projectId=${encodeURIComponent(folderId)}`
    );
  }

  async function runExamsFlow(folderId: string, values: ExamSetupValues) {
    const targetPath = `/exams?projectId=${encodeURIComponent(folderId)}`;
    savePendingGenerationIntent({
      type: 'exam_generate',
      path: targetPath,
      payload: { values },
    });
    router.push(targetPath);
  }

  async function orchestrateCreation(examValues?: ExamSetupValues) {
    if (!selected) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const uploadedInputs = await uploadProjectInputs();
      const folderId = await createFolder(uploadedInputs);

      switch (selected) {
        case 'cheat-sheets':
          await runCheatsheetFlow(folderId, uploadedInputs);
          break;
        case 'lecture-notes':
          await runLectureNotesFlow(folderId, uploadedInputs);
          break;
        case 'problem-solver':
          await runProblemSolverFlow(folderId);
          break;
        case 'exams':
          if (!examValues) throw new Error('Exam configuration is missing.');
          await runExamsFlow(folderId, examValues);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create notebook.');
      setIsSubmitting(false);
    }
  }

  function handleContinueClick() {
    if (!canCreateProject) return;
    if (selected === 'exams') {
      // Exams: Continue is a submit button targeting the exam form.
      // The form's onSubmit handler (handleExamSetupSubmit) drives the flow.
      return;
    }
    void orchestrateCreation();
  }

  function handleExamSetupSubmit(values: ExamSetupValues) {
    if (isSubmitting) return;
    if (!title.trim() || !selected) return;
    void orchestrateCreation(values);
  }

  const continueIsSubmit = selected === 'exams' && !isSubmitting;

  const statusMessage = (() => {
    if (step === 'details' && !title.trim()) return 'Add a title to continue.';
    if (step !== 'workflow') return '';
    if (!selected) return 'Select a resource to continue.';
    if (promptIsRequiredFor(selected) && !prompt.trim()) return 'Add an input to continue.';
    if (selected === 'cheat-sheets' && cheatsheetTemplateId === null) {
      return 'Pick a cheatsheet template to continue.';
    }
    if (selected === 'lecture-notes') {
      if (reportTemplateId === null) return 'Pick a report template to continue.';
      if (lectureNotesPages === null) return 'Pick a length (pages) to continue.';
      if (lectureNotesDensity === null) return 'Pick a density to continue.';
      if (lectureNotesLanguage === null) return 'Pick a language to continue.';
    }
    if (selected === 'problem-solver' && !problemSolverFile) {
      return 'Upload a PDF to continue.';
    }
    return '';
  })();

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      <div className="border-b border-white/10 px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={handleBackOrClose}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/45 hover:text-white transition-colors"
            title={step === 'workflow' ? 'Back to notebook details' : 'Back to documents'}
            aria-label={step === 'workflow' ? 'Back to notebook details' : 'Back to documents'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold truncate">New Notebook</h1>
        </div>
        <span className="text-[11px] uppercase tracking-wide text-white/40">
          {step === 'details' ? 'Step 1 / 2' : 'Step 2 / 2'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-12">
          {step === 'details' ? (
            <>
              <h2 className="text-3xl font-semibold tracking-tight mb-2">
                Create a new{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
                  notebook
                </span>
              </h2>
              <p className="text-white/50 text-sm mb-10">
                Add the notebook details and your global input documents.
              </p>

              <div className="mb-6">
                <label htmlFor="project-title" className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
                  Title
                </label>
                <input
                  id="project-title"
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); resetError(); }}
                  placeholder="e.g. Thermodynamics — Semester 3"
                  maxLength={120}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white
                    placeholder-white/30 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/8"
                  autoFocus
                />
              </div>

              <div className="mb-8">
                <label htmlFor="project-description" className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
                  Description <span className="text-white/35 normal-case font-normal tracking-normal">— optional, used as context for AI-generated documents</span>
                </label>
                <textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); resetError(); }}
                  placeholder="Briefly describe the subject, level or scope (e.g. Undergraduate thermodynamics course covering the three laws, ideal gases, and thermodynamic cycles)."
                  rows={4}
                  maxLength={800}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white
                    placeholder-white/30 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/8 resize-none leading-relaxed"
                />
                <div className="text-[11px] text-white/35 mt-1.5 text-right tabular-nums">
                  {description.length} / 800
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">
                  Label color <span className="text-white/35 normal-case font-normal tracking-normal">— optional</span>
                </label>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setLabelColor(null); resetError(); }}
                    aria-pressed={labelColor === null}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      labelColor === null
                        ? 'border-indigo-400/70 bg-indigo-500/18 text-indigo-200'
                        : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white/45" />
                    Default
                  </button>

                  {PROJECT_COLOR_OPTIONS.map((option) => {
                    const isSelected = labelColor === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => { setLabelColor(option.value); resetError(); }}
                        aria-label={`Set label color to ${option.label}`}
                        aria-pressed={isSelected}
                        className={`relative inline-flex items-center justify-center w-6 h-6 rounded-full border transition-all ${
                          isSelected
                            ? 'border-white/70 shadow-[0_0_0_2px_rgba(99,102,241,0.45)]'
                            : 'border-white/20 hover:border-white/45'
                        }`}
                        style={{ backgroundColor: option.value }}
                        title={option.label}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
                  Notebook input documents <span className="text-white/35 normal-case font-normal tracking-normal">— optional, global for this notebook</span>
                </label>
                <p className="text-xs text-white/45 mb-3">
                  Add PDFs, DOCX or images. They stay attached to this notebook as reusable context.
                </p>

                <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                    onChange={handleInputFilesSelected}
                    className="hidden"
                  />

                  <div className="mx-auto w-full max-w-2xl">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleInputDropzoneDragOver}
                      onDragLeave={handleInputDropzoneDragLeave}
                      onDrop={handleInputDropzoneDrop}
                      className={`relative w-full rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
                        flex items-center gap-4 px-4 py-4 ${
                          isInputDropDragging
                            ? 'border-orange-400 bg-orange-500/8'
                            : 'border-white/20 bg-white/[0.03] hover:border-white/35 hover:bg-white/[0.05]'
                        }`}
                    >
                      <div
                        className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors duration-200 ${
                          isInputDropDragging
                            ? 'bg-orange-500/20 border-orange-400/40'
                            : 'bg-orange-500/15 border-orange-500/25'
                        }`}
                      >
                        <svg
                          className={`w-6 h-6 transition-colors ${isInputDropDragging ? 'text-orange-300' : 'text-orange-400'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                          />
                        </svg>
                      </div>

                      <div className="min-w-0 text-left">
                        <p className="text-white/92 font-medium text-sm leading-tight">
                          Drop your notebook files here
                        </p>
                        <p className="text-white/45 text-sm leading-tight mt-1">or click to browse</p>
                        <p className="text-white/30 text-xs mt-2">
                          PDF, DOCX, JPG, PNG, WEBP · max {MAX_PROJECT_TOTAL_UPLOAD_MB} MB
                        </p>
                      </div>
                    </div>

                    {projectInputFiles.length > 0 && (
                      <div className="mt-4">
                        <div className="text-[11px] text-white/40 mb-2">
                          {projectInputFiles.length} file{projectInputFiles.length === 1 ? '' : 's'} · {formatBytes(totalInputBytes)} / {MAX_PROJECT_TOTAL_UPLOAD_MB} MB
                        </div>
                        <ul className="space-y-2">
                          {projectInputFiles.map((file, index) => (
                            <li
                              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs text-white/85 truncate">{file.name}</p>
                                <p className="text-[11px] text-white/45">{formatBytes(file.size)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeInputFile(index)}
                                className="shrink-0 text-[11px] text-white/50 hover:text-red-300 transition-colors"
                                title={`Remove ${file.name}`}
                                aria-label={`Remove ${file.name}`}
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {projectInputFiles.length === 0 && (
                      <div className="mt-3 text-[11px] text-white/38">
                        0 files · 0 B / {MAX_PROJECT_TOTAL_UPLOAD_MB} MB
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-semibold tracking-tight mb-2">
                ¿Qué es lo que quieres{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
                  crear?
                </span>
              </h2>
              <p className="text-white/50 text-sm mb-8">
                Write the initial request and choose the resource type.
              </p>

              <div className="mb-8">
                <label htmlFor="project-intent" className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
                  Creation input{' '}
                  {selected && !promptIsRequiredFor(selected) && (
                    <span className="text-white/35 normal-case font-normal tracking-normal">— optional</span>
                  )}
                </label>
                <textarea
                  ref={promptTextareaRef}
                  id="project-intent"
                  value={prompt}
                  onChange={handlePromptChange}
                  placeholder={promptPlaceholderFor(selected)}
                  maxLength={400}
                  rows={2}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white
                    placeholder-white/30 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/8
                    resize-y min-h-[84px] max-h-56 overflow-y-auto leading-relaxed disabled:opacity-60"
                  autoFocus
                />
                <div className="text-[11px] text-white/35 mt-1.5 text-right tabular-nums">
                  {prompt.length} / 400
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">
                  Select resource
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {WORKFLOWS.map((option) => {
                    const isSelected = selected === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSelectResource(option.id)}
                        aria-pressed={isSelected}
                        className={`group relative text-left rounded-2xl border bg-gradient-to-br ${option.accent}
                          transition-all p-5 disabled:opacity-60 disabled:cursor-not-allowed ${
                            isSelected
                              ? 'border-indigo-400/80 shadow-[0_0_0_1px_rgba(129,140,248,0.6),0_10px_30px_rgba(79,70,229,0.25)]'
                              : 'border-white/15 hover:border-white/30 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)]'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h3 className="text-base font-semibold text-white">{option.title}</h3>
                          <span
                            className={`flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                              isSelected
                                ? 'border-indigo-300 bg-indigo-400/90 text-white'
                                : 'border-white/30 bg-transparent text-transparent group-hover:border-white/50'
                            }`}
                            aria-hidden
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        </div>
                        <p className="text-xs text-white/55 leading-relaxed">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selected === 'cheat-sheets' && (
                <CheatsheetPanel
                  selectedTemplateId={cheatsheetTemplateId}
                  onSelect={(id) => { setCheatsheetTemplateId(id); resetError(); }}
                  disabled={isSubmitting}
                />
              )}

              {selected === 'lecture-notes' && (
                <LectureNotesPanel
                  templateId={reportTemplateId}
                  pages={lectureNotesPages}
                  density={lectureNotesDensity}
                  language={lectureNotesLanguage}
                  onChange={(next) => {
                    if (next.templateId !== undefined) setReportTemplateId(next.templateId);
                    if (next.pages !== undefined) setLectureNotesPages(next.pages);
                    if (next.density !== undefined) setLectureNotesDensity(next.density);
                    if (next.language !== undefined) setLectureNotesLanguage(next.language);
                    resetError();
                  }}
                  disabled={isSubmitting}
                />
              )}

              {selected === 'problem-solver' && (
                <ProblemSolverPanel
                  file={problemSolverFile}
                  onFileChange={(next) => { setProblemSolverFile(next); resetError(); }}
                  onError={setError}
                  disabled={isSubmitting}
                />
              )}

              {selected === 'exams' && (
                <ExamsPanel
                  onSubmit={handleExamSetupSubmit}
                  isLoading={isSubmitting}
                  error={error}
                />
              )}
            </>
          )}

          {error && selected !== 'exams' && (
            <div className="mt-6 mb-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="text-[11px] text-white/40">
              {statusMessage}
            </div>
            <button
              type={continueIsSubmit ? 'submit' : 'button'}
              form={continueIsSubmit ? 'exam-setup-form' : undefined}
              onClick={
                step === 'details'
                  ? handleGoToWorkflowStep
                  : continueIsSubmit
                  ? undefined
                  : handleContinueClick
              }
              disabled={step === 'details' ? !canContinueStepOne : !canCreateProject}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                (step === 'details' ? canContinueStepOne : canCreateProject)
                  ? 'bg-gradient-to-r from-[#b04cff] via-[#7d5cff] to-[#3d7dff] text-white shadow-[0_4px_14px_rgba(96,82,255,0.45)] hover:shadow-[0_6px_18px_rgba(85,116,255,0.52)]'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  Continue
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
